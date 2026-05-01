---
title: "Azure load balancer SNAT behavior explained - Annotations to tcp port numbers reused, ACK with wrong sequence number plus RST from 3-way handshake and SNAT port exhaustion"
slug: "azure-load-balancer-snat-behavior-explained"
date: "2019-11-16 09:44:59"
updated: "2023-01-15 05:26:21"
type: "post"
status: "published"
visibility: "public"
featured: true
excerpt: "This article will address azure external load balancer and focus on SNAT,  explains a few of behaviors seen from network trace, provides a few of suggestions for application when it is behind of load balancer and requires SNAT."
feature_image: "/assets/posts/azure-load-balancer-snat-behavior-explained/hero.jpg"
authors: ["Yingting Huang"]
tags: ["Load Balancer", "Debugging", "Azure", "Linux"]
---
_Notice_: The article was published 2 years agao, some information may not be correct anymore, please refer to offical Azure document for updated information.

## 0 Summary

Yes, summary, no kidding :), if you don't have time to read whole article, try follow below suggestions

1.  Use TCP keepalive from your application behind load balancer to avoid idle connection being teared down from host flow table.
2.  Consider of using Azure standard load balancer and enable [Load Balancer with TCP Reset on Idle (Public Preview)](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-tcp-reset) feature.
3.  Most of time, TCP port numbers reused is not a problem.
4.  SNAT port exhaustion could also happens when guest OS has a few of active connections, try to avoid creating and closing outbound connections aggressively, reuse existing connection and follow suggestion 1.

## 1 Azure Load Balancer SNAT Introduction

Azure load balancer has two types, internal and external, this article will address external load balancer and focus on SNAT, explains a few of behaviors seen from network trace.

Azure external load balancer is a service simply does two things

1.  Distributes inbound traffics against its public IP to back-end instances.
2.  Source NAT outbound traffics from backend instances by translating private IP addresses to its public IP address.

NOTE: Backend instance is usually VM, or services running from VM, and VM is running from host.

A typical SNAT traffic flow looks like in below  
![LB_SNAT](/assets/posts/azure-load-balancer-snat-behavior-explained/lb-snat.svg)

For an overview of Azure load balancer, refer to article [What is Azure Load Balancer?](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-overview)

### 1.1 SNAT

When apply outbound SNAT, outbound traffic's source IP and source port will be rewritten to load balancer's public IP and SNAT port, as SNAT port is a limited resource(A port number is a 16-bit integer ranging from 0 to 65535), load balancer will preallocate SNAT port to backend server's instances, it is documented in [Ephemeral port preallocation for port masquerading SNAT (PAT)](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-outbound-connections#preallocatedports)

<table><thead><tr><th>Pool size (VM instances)</th><th>Preallocated SNAT ports per IP configuration</th></tr></thead><tbody><tr><td>1-50</td><td>1,024</td></tr><tr><td>51-100</td><td>512</td></tr><tr><td>101-200</td><td>256</td></tr><tr><td>201-400</td><td>256</td></tr><tr><td>401-800</td><td>64</td></tr><tr><td>801-1,000</td><td>32</td></tr><tr><td>NOTE: Preallocated SNAT ports is adjustable in Azure standard load balancer, to make this article easy to understand, we just presume each backend instance has limited SNAT ports assigned per above table.</td><td></td></tr></tbody></table>

### 1.2 SNAT port exhaustion

When backend instance makes outbound connections, each connection will have a SNAT port allocated from instance's NAT pool, when SNAT port resources are exhausted, outbound connection fails until SNAT ports get released. This is so called [SNAT port exhaustion](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-outbound-connections#exhaustion).

### 1.3 SNAT port reuse

Besides limited SNAT ports allocated for each backend instance, backend instance's host also maintenances a flow table to record SNAT mapping information(Source IP, Port -> Public IP, SNAT Port), if the outbound connection is a TCP connection, a few of TCP state information is also maintained in the flow table. Host flow table is used to track outbound connection's state and release SNAT port to NAT pool. Once SNAT port is released and put back to NAT pool, new connection can reuse the same SNAT port([SNAT port reuse](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-outbound-connections#snat-port-reuse)). SNAT port gets released under below conditions, refer to [SNAT port release](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-outbound-connections#tcp-snat-port-release)

> TCP SNAT port release

> If either server/client sends FINACK, SNAT port will be released after 240 seconds.  
> If a RST is seen, SNAT port will be released after 15 seconds.If idle timeout has been reached, port is released.

> UDP SNAT port release

> If idle timeout has been reached, port is released.

## 2 Typical observations and issues

Load balancer SNAT could bring complicated issues, as guest OS also maintains TCP/UDP state, specially for TCP, if host flow table isn't consistent with guest OS TCP/IP stack.

Here are some typical observations and issues

### 2.1 Observation 1 - TCP port numbers reused

TCP port numbers reused can happen in below circumstances with Azure load balancer being used

#### 2.1.1 TCP port number gets reused by new connection when old connection gets reset

When TCP connection is reset, azure load balancer releases SNAT port to NAT pool, according to [SNAT port reuse](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-outbound-connections#snat-port-reuse)

> You can think of SNAT ports as a sequence from lowest to highest available for a given scenario, and the first available SNAT port is used for new connections.

It basically means, after 15 seconds(**If a RST is seen, SNAT port will be released after 15 seconds**), new outbound connection will use same SNAT port if no other connection made out. If destination keeps resetting connection, new connection from source will keep using same SNAT port at 15 seconds interval.

For example, in below screen shot, 52.187.X.X is public IP of azure load balancer, when destination 62.209.X.X reset the connection, you will see same SNAT port number is reused, right after 15 seconds(frame 269).  
![RST_PORT_REUSE](/assets/posts/azure-load-balancer-snat-behavior-explained/rst-port-reuse.jpg)

Will port number reused be a problem under the condition when previous connection is reset? The answer is NO, as both host flow table and guest OS TCP/IP stack removed connection state, a new connection is actually a new connection.

#### 2.1.2 TCP port number gets reused after connection gracefully closed

When TCP connection gets gracefully closed (**If either server/client sends FINACK, SNAT port will be released after 240 seconds.**), for example, if source closed connection, guest OS will put corresponding socket in TIME\_WAIT state, host will also put corresponding flow in TIME\_WAIT state and release SNAT port after 240 seconds. Guest OS default TIME\_WAIT duration is 120 seconds in Windows(Adjustable through TcpTimedWaitDelay), 60 seconds in Linux(Non-adjustable), so when the SNAT port is released to NAT pool and reused for new connection, old TCP connection is already long gone from guest OS, which makes guest OS sees the new connection as new connection. In that case, TCP port number reused won't be a problem as both host flow table and guest OS are in sync.

#### 2.1.3 TCP port number gets reused when connection idle time reached

When a outbound connection idles for too long without any activities(**If idle timeout has been reached, port is released.**), by default it is 240 seconds in Azure load balancer, its flow will be removed from host flow table, basically it means the connection is teared down from host flow table, SNAT port is released to NAT pool, new connection can reuse SNAT port. However from source guest OS's perspective, the connection is still technically alive in its TCP/IP stack(established), strange behaviors can be seen from here, this is because host flow table is un-synced with guest OS TCP/IP stack.

For example, from below tcpdump trace we can see TCP port number resused as well as ACK with wrong sequence number plus RST from 3-way handshake. The trace is captured from destination side, 52.187.X.X is load balancer public IP and port 2560 is SNAT port, 62.209.X.X is destination IP and 5000 is destination port.

> \[1\] 10:11:54.310366 IP 52.187.X.X.2560 > 62.209.X.X.5000: Flags \[S\], seq 3315641323, win 29200, options \[mss 1440,s451 ecr 0,nop,wscale 7\], length 0  
> \[2\] 10:11:54.310423 IP 62.209.X.X.5000 > 52.187.X.X.2560: Flags \[S.\], seq 3490535665, **ack 3315641324**, win 28960, opOK,TS val 1094630349 ecr 1164401451,nop,wscale 7\], length 0  
> \[3\] **10:11:54.311100** IP 52.187.X.X.2560 > 62.209.X.X.5000: Flags \[.\], ack 3490535666, win 229, options \[nop,nop,TS v94630349\], length 0  
> ...  
> \[4\] **10:16:31.860969** IP 52.187.X.X.2560 > 62.209.X.X.5000: Flags \[S\], **seq 2233907357**, win 29200, options \[mss 1440,s002 ecr 0,nop,wscale 7\], length 0  
> \[5\] 10:16:31.861002 IP 62.209.X.X.5000 > 52.187.X.X.2560: Flags \[.\], **ack 3315641324**, win 227, options \[nop,nop,TS v64401453\], length 0  
> \[6\] 10:16:31.862546 IP 52.187.X.X.2560 > 62.209.X.X.5000: Flags \[R\], **seq 3315641324**, win 0, length 0  
> \[7\] 10:16:32.863887 IP 52.187.X.X.2560 > 62.209.X.X.5000: Flags \[S\], seq 2233907357, win 29200, options \[mss 1440,s005 ecr 0,nop,wscale 7\], length 0  
> \[8\] 10:16:32.863944 IP 62.209.X.X.5000 > 52.187.X.X.2560: Flags \[S.\], seq 3547967158, ack 2233907358, win 28960, opOK,TS val 1094908903 ecr 1164680005,nop,wscale 7\], length 0  
> \[9\] 10:16:32.864836 IP 52.187.X.X.2560 > 62.209.X.X.5000: Flags \[.\], ack 3547967159, win 229, options \[nop,nop,TS v94908903\], length 0

*   Frame 1 - 3, first connection is established after TCP 3-way handshake.
*   After > 4 mins, a new connection is made with same SNAT port(frame 4), destination ACK-ed a wrong sequence number(frame 5), hence source reset the connection(frame 6). Source retransmitted SYN again(frame 7) and TCP 3-way handshake is completed with frame 8 and 9. Frame 4 - 9 are actually made by a single API call connect(), guest OS TCP/IP handles all the work, application who calls connect() isn't aware of the TCP RST, application only sees the connect() call is succeeded
*   What happens here is
    *   First connection reached idle timeout, backend instance's host removed corresponding flow from its flow table, released SNAT port to NAT pool.
    *   Second connection reused SNAT port and sent a TCP SYN to destination, as 5 tuples(protocol, source ip, source port, destination ip, destination port) is same, destination think it is from first connection but with an invalid TCP sequence number it expected to see, so destination ACK-ed last sequence number + 1 from source it used to see(same as frame 2).
    *   Source guest OS got a wrong ACK-ed sequence number packet during second connection's 3-way handshake, so it sent a RST packet to destination, once destination got the RST packet, it teared down first connection from its TCP/IP stack, so first connection's state is gone from destination guest OS.
    *   When source retransmitted second connection's SYN to destination, this time, as first connection's state is gone from destination, so 3-way handshake eventually completed.
*   Now in source guest OS there will be 2 active outbound connections to destination, why? This is because, from guest OS, first outbound connection uses source ip and source portA, when making second connection from guest OS, as first connection is still alive, portA won't be reused from guest OS, so another source portB will be allocated from guest OS. Run `ss -taeip dport = :5000` will show there are two connections in guest OS

```bash
State       Recv-Q Send-Q                 Local Address:Port                                  Peer Address:Port                
ESTAB       0      0                         172.16.0.5:55546                               62.209.X.X:5000                  users:(("client",pid=6467,fd=3)) uid:1000 ino:74305375 sk:9d <->
	 ts sack cubic wscale:7,7 rto:200 rtt:1.634/0.817 ato:40 mss:1428 cwnd:10 bytes_acked:1 bytes_received:26 segs_out:3 segs_in:2 send 69.9Mbps lastsnd:15308 lastrcv:15308 lastack:15308 pacing_rate 139.8Mbps rcv_space:29200
ESTAB       0      0                         172.16.0.5:52868                               62.209.X.X:5000                  users:(("client",pid=129270,fd=3)) uid:1000 ino:74277694 sk:7f <->
	 ts sack cubic wscale:7,7 rto:200 rtt:1.6/0.8 ato:40 mss:1428 cwnd:10 bytes_acked:1 bytes_received:26 segs_out:3 segs_in:2 send 71.4Mbps lastsnd:457212 lastrcv:457212 lastack:457212 pacing_rate 142.8Mbps rcv_space:29200
```

*   As first connection reached idle timeout from host flow table, old flow is removed, second connection will create a new flow, map source ip and source portB to load balancer's public ip and SNAT port. Start from here, inbound/outbound traffics will only happens on second connection as no mapping for first connection in host flow table, which leaves an orphaned connection in guest OS, consumes resource and never get change to release. It could get worse if source want to send data on first connection, guest OS TCP/IP stack will retransmit the data again and again, until it reaches timeout, in Linux by default, it could be 15 minutes later, refer to [Linux TCP\_RTO\_MIN, TCP\_RTO\_MAX and the tcp\_retries2 sysctl](https://pracucci.com/linux-tcp-rto-min-max-and-tcp-retries2.html), if application uses thread/threadpool and call block I/O API send() to send data, then the thread could block here for 15 mins.

#### 2.1.4 Solution to avoid idle outbound TCP connections

1.  Use TCP keepalive to avoid idle connection being teared down from host flow table. TCP keepalive can be enabled in both source and destination side, when enabled, TCP/IP stack will send keepalive packet over the connection to determine if the connection is still valid, and terminate it if needed. As host keeps seeing traffics between source and destination, so it will not remove corresponding flow from its flow table.
2.  If Azure standard load balancer is being used, there is a preview feature called [Load Balancer with TCP Reset on Idle (Public Preview)](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-tcp-reset). Enabling this feature will cause Load Balancer to send bidirectional TCP Resets (TCP RST packet) on idle timeout. This will inform guest OS to tear down TCP state, so both guest OS and host are in-sync.

### 2.2 Observation 2 - SNAT port exhaustion without too many active connections

When SNAT port exhaustion occurs, application from backend instance won't be able to establish outbound connection to destination, this is because no SNAT port is available, TCP SYN will silently get dropped from host. Depends on application's behavior, if block I/O connect() is used, application will hang there for a while until it can get a SNAT port or timed out when SYN retransmission timeout reached, if application uses non-block I/O(for example, epoll() with connect()), when timeout reached, application will abort the connection and report timeout error.

SNAT port exhaustion is usually seen when guest OS has too many active connections, but it can also happen under the circumstance without too may active connections in guest OS. To explain how it happens, considering an application

1.  Temporarily made a lot of outbound connections to destination in very short time and consumed all SNAT port from NAT pool.
2.  Destination actively closed connection after sending out data.

In that case, guest OS TCP/IP stack has already removed TCP connection's state when it was closed, while host still keeps the flow in its flow table(If either server/client sends FINACK, SNAT port will be released after 240 seconds.), since SNAT port didn't get released yet(TIME\_WAIT state in host flow table), new outbound connection from guest OS still will get SNAT port exhaustion issue.

For example, below tcpdump shows application is trying to resend TCP SYN and eventually connected to destination with second tries.

**03:52:03.626271** IP 172.16.0.5.33858 > 62.209.X.X:5000: Flags \[S\], seq 4184725213, win 29200, options \[mss 1460,sackOK,TS val 4219049655 ecr 0,nop,wscale 7\], length 0  
...  
**03:53:08.729123** IP 172.16.0.5.33858 > 62.209.X.X:5000: Flags \[S\], seq 4184725213, win 29200, options \[mss 1460,sackOK,TS val 4219114758 ecr 0,nop,wscale 7\], length 0  
**// First connect request is timed out**  
03:54:14.276328 IP 172.16.0.5.34648 > 62.209.X.X:5000: Flags \[S\], seq 671129119, win 29200, options \[mss 1460,sackOK,TS val 4219180305 ecr 0,nop,wscale 7\], length 0  
03:54:14.277685 IP 62.209.X.X:5000 > 172.16.0.5.34648: Flags \[S.\], seq 1174869554, ack 671129120, win 28960, options \[mss 1440,sackOK,TS val 1140667722 ecr 4219180305,nop,wscale 7\], length 0  
03:54:14.277783 IP 172.16.0.5.34648 > 62.209.X.X:5000: Flags \[.\], ack 1, win 229, options \[nop,nop,TS val 4219180306 ecr 1140667722\], length 0  
**// Second connect request is succeeded**

The gist to avoid this kind of issue is, keep reusing connections instead of creating new ones.

## 3 Warp it up

Please see "0 Summary" :)
