---
title: "Flannel Networking Demystify"
slug: "flannel-networking-demystify"
date: "2018-06-01 06:36:30"
updated: "2018-12-23 03:04:22"
type: "post"
status: "published"
visibility: "public"
featured: true
excerpt: ""
feature_image: "/assets/posts/flannel-networking-demystify/hero.jpeg"
authors: ["Yingting Huang"]
tags: ["Flannel", "VXLAN", "Linux", "K8S", "Kubernetes", "Acceleratd Networking"]
---
In my previous article [Deploy a Ubuntu Based Flannel K8S Cluster in Azure with ARM Template and Kubeadm](/deploy-a-ubuntu-based-flannel-k8s-cluster-in-azure-with-arm-template-and-kubeadm/), I provided an Azure ARM template to deploy a flannel networking K8S cluster on Azure. But how flannel networking works, in this article we will discuss a little bit about the internals, specially for its `VXLAN`, `udp` and `host-gw` mode.

## 0 What is Flannel

Refer to [Flannel](https://github.com/coreos/flannel)

> Flannel is a simple and easy way to configure a layer 3 network fabric designed for Kubernetes.

Flannel create a flat network runs above host's network, it is an overlay networking solution for K8S cluster.

## 1 How it Works

Refer to [Flannel](https://github.com/coreos/flannel)

> Flannel runs a small, single binary agent called `flanneld` on each host, and is responsible for allocating a subnet lease to each host out of a larger, preconfigured address space. Flannel uses either the Kubernetes API or etcd directly to store the network configuration, the allocated subnets, and any auxiliary data (such as the host's public IP). Packets are forwarded using one of several backend mechanisms including VXLAN and various cloud integrations.

`flanneld` runs under `kube-flannel-ds-*` containter, this container is created/configure when flannel networking is applied to kubernetes cluster.

```bash
kubectl get pods --namespace=kube-system -o wide
NAME                                              READY     STATUS    RESTARTS   AGE       IP           NODE
...
kube-flannel-ds-kklgx                             1/1       Running   4          21d       172.16.0.4   k8snode-342zzth442uje-0
kube-flannel-ds-rk2k2                             1/1       Running   3          21d       172.16.0.5   k8snode-342zzth442uje-1
...
```

Currently Flannel networking supports three backends

*   VXLAN
*   UDP
*   Host-GW

## 2 Networking Details

Refer to [Flannel](https://github.com/coreos/flannel)

> Flannel is responsible for providing a layer 3 IPv4 network between multiple nodes in a cluster. Flannel does not control how containers are networked to the host, only how the traffic is transported between hosts. However, flannel does provide a CNI plugin for Kubernetes and a guidance on integrating with Docker.

To illustrate how flannel networking works, we deployed a 2 nodes flannel K8s cluster to Azure, below is the networking diagram  
![Flannel](/assets/posts/flannel-networking-demystify/flannel.jpg)

### 2.1 Flannel Networking Space

By default, flannel will have a 10.244.X.0/24 subnet allocated to each node, K8S Pod will use IP address from subnet's address space.

### 2.2 Veth Pair

For each K8S Pod, flannel will create a pair of veth devices. Refer to [veth](http://man7.org/linux/man-pages/man4/veth.4.html) Taking node1 for example, eth0(containern) is created in flannel network namespace, vethxxxxxxxx is created in host network namespace.

> The veth devices are virtual Ethernet devices. They can act as tunnels between network namespaces to create a bridge to a physical  
> network device in another namespace.

```bash
ifconfig -a
...
veth43b57597 Link encap:Ethernet  HWaddr 92:e6:95:33:81:fc  
          inet6 addr: fe80::90e6:95ff:fe33:81fc/64 Scope:Link
          UP BROADCAST RUNNING MULTICAST  MTU:1450  Metric:1
          RX packets:218343 errors:0 dropped:0 overruns:0 frame:0
          TX packets:247970 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:0 
          RX bytes:41250604 (41.2 MB)  TX bytes:28812043 (28.8 MB)

veth822966d6 Link encap:Ethernet  HWaddr 8a:fa:7b:db:62:3e  
          inet6 addr: fe80::88fa:7bff:fedb:623e/64 Scope:Link
          UP BROADCAST RUNNING MULTICAST  MTU:1450  Metric:1
          RX packets:5123 errors:0 dropped:0 overruns:0 frame:0
          TX packets:9927 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:0 
          RX bytes:489234 (489.2 KB)  TX bytes:953998 (953.9 KB)
...
```

### 2.3 Cni0 Bridge

Interface vethxxxxxxxx is connected to interface cni0, cni0 is a Linux network bridge device, all veth devices will connect to this bridge, so all containers in same node can communicate with each other. cni0 has ip address 10.244.X.1,

To check cni0 details, run `ip -d link show cni0`

```bash
5: cni0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1450 qdisc noqueue state UP mode DEFAULT group default qlen 1000
    link/ether 0a:58:0a:f4:01:01 brd ff:ff:ff:ff:ff:ff promiscuity 0 
    bridge forward_delay 1500 hello_time 200 max_age 2000 ageing_time 30000 stp_state 0 priority 32768 vlan_filtering 0 vlan_protocol 802.1Q addrgenmode eui64
```

We can verify veth device is connected with cni0 by issuing command `ip -d link show veth43b57597`

```bash
...
6: veth43b57597@if3: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1450 qdisc noqueue master cni0 state UP mode DEFAULT group default 
    link/ether 92:e6:95:33:81:fc brd ff:ff:ff:ff:ff:ff link-netnsid 0 promiscuity 1 
    veth 
    bridge_slave state forwarding priority 32 cost 2 hairpin on guard off root_block off fastleave off learning on flood on addrgenmode eui64
```

It shows veth43b57597 is a bridge\_slave and it's master is cni0.

```bash
bridge vlan show
port	vlan ids
docker0	 1 PVID Egress Untagged

cni0	 1 PVID Egress Untagged

veth43b57597	 1 PVID Egress Untagged

veth822966d6	 1 PVID Egress Untagged
```

### 2.4 VXLAN Device

When VXLAN backend is being used by flannel, a VXLAN device whose name is flannel.<vni> will be created, <vni> stands for VXLAN Network Identifier, by default in flannel VNI is set to 1, that means the default device name is flannel.1. `ip -d link show flannel.1` will show details about this VXALN device

```bash
4: flannel.1: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1450 qdisc noqueue state UNKNOWN mode DEFAULT group default 
    link/ether 8e:d0:f8:0a:41:19 brd ff:ff:ff:ff:ff:ff promiscuity 0 
    vxlan id 1 local 172.16.0.5 dev eth0 srcport 0 0 dstport 8472 nolearning ageing 300 udpcsum addrgenmode eui64 
```

As displayed from above output, vxlan id is 1, eth0 device is used in tunneling, VXLAN UDP port is 8472 and the nolearning tag that disables source-address learning meaning Multicast is not used but Unicast with static L3 entries for the peers.

VXLAN device flannel.1 is linked with physical network device eth0 to send out VXLAN traffics through physical network. Agent `flanneld` will populate node ARP table as well as the bridge forwarding database, so flannel.1 knows how to forward traffics within physical network. When a new kubernetes node is found (either during startup or when it’s created), `flanneld` adds

*   ARP entry for remote node's VXLAN device. (VXLAN device IP->VXLAN device MAC)
*   VXLAN fdb entry to remote host. (VXLAN device MAC->Remote Node IP)

Sample ARP entry and FDB entry from node1

```bash
# Permanet ARP entry programmed by flanneld
ip neigh show dev flannel.1
10.244.0.0 lladdr 76:34:2f:c5:51:ec PERMANENT

# Static fdb database programmed by flanneld
bridge fdb show flannel.1
33:33:00:00:00:01 dev eth0 self permanent
01:00:5e:00:00:01 dev eth0 self permanent
33:33:ff:a3:fa:d5 dev eth0 self permanent
33:33:00:00:00:01 dev docker0 self permanent
01:00:5e:00:00:01 dev docker0 self permanent
02:42:cf:eb:2d:10 dev docker0 master docker0 permanent
02:42:cf:eb:2d:10 dev docker0 vlan 1 master docker0 permanent
76:34:2f:c5:51:ec dev flannel.1 dst 172.16.0.4 self permanent
33:33:00:00:00:01 dev cni0 self permanent
01:00:5e:00:00:01 dev cni0 self permanent
33:33:ff:c4:13:6e dev cni0 self permanent
0a:58:0a:f4:01:01 dev cni0 master cni0 permanent
0a:58:0a:f4:01:01 dev cni0 vlan 1 master cni0 permanent
92:e6:95:33:81:fc dev veth43b57597 vlan 1 master cni0 permanent
92:e6:95:33:81:fc dev veth43b57597 master cni0 permanent
0a:58:0a:f4:01:04 dev veth43b57597 master cni0 
33:33:00:00:00:01 dev veth43b57597 self permanent
01:00:5e:00:00:01 dev veth43b57597 self permanent
33:33:ff:33:81:fc dev veth43b57597 self permanent
8a:fa:7b:db:62:3e dev veth822966d6 vlan 1 master cni0 permanent
8a:fa:7b:db:62:3e dev veth822966d6 master cni0 permanent
33:33:00:00:00:01 dev veth822966d6 self permanent
01:00:5e:00:00:01 dev veth822966d6 self permanent
33:33:ff:db:62:3e dev veth822966d6 self permanent
```

### 2.5 VXLAN Routing

Traffics between cni0 and flannel.1 are forwarded by iptables, the configuration is in below.

```bash
# Check ip_forward is enabled or not
cat /proc/sys/net/ipv4/ip_forward
1

# Check iptables setting, forwarding is configured for flannel's networking address space
iptables-save
...
-A FORWARD -s 10.244.0.0/16 -j ACCEPT
-A FORWARD -d 10.244.0.0/16 -j ACCEPT
...
```

If you look into details if host node's routing table. We can find containers in same host node communicate to each other over the cni0 linux bridge (each container gets its own network namespace which gets connected to cni0 bridge via pair of veth interfaces) and traffics go to the containers in other host nodes will via flannel.1 interface as per routing table rule for the 10.244.0.0/24 subnet.

```bash
route
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
...
10.244.0.0      10.244.0.0      255.255.255.0   UG    0      0        0 flannel.1
10.244.1.0      *               255.255.255.0   U     0      0        0 cni0
...
```

### 2.6 Connecting the Dots(VXLAN)

Connecting the dots, the network flow will looks like in below  
![flannel-network-flow](/assets/posts/flannel-networking-demystify/flannel-network-flow.jpg)

Imageing Pod-A from node1 is going to send data to Pod-B in node0, Pod-A's IP address is 10.244.1.5 and Pod-B's IP address is 10.244.0.5

*   Pod-A's outbound packet will go to cni0 bridge
*   Then it gets forwarded to device flannel.1 based on routing table entry `10.244.0.0 10.244.0.0 255.255.255.0 UG 0 0 0 flannel.1`
*   Flannel.1 uses 10.244.0.0's MAC address `76:34:2f:c5:51:ec`(populated by `flanneld`) as the destination MAC for inner ethernet packet.
*   Next, flannel.1 needs to get VXLAN Tunnel Endpoint(VTEP)'s destination IP to send it out. By looking for `76:34:2f:c5:51:ec` from bridge fdb database, flannel.1 now has the IP address 172.16.0.4 of destination node, and a wrapped VXLAN packet is sent to node0.
*   node0 will pass up this packet to Pod-B by applying the reversed packet processing logic.

## 3 A Real Example of VXLAN Backend

Let's run an interactive shell from kubernetes and give it a name called `busybox`

```bash
kubectl run -i --tty busybox --image=busybox -- sh
```

We can see `busybox` was running under node k8snode-342zzth442uje-1

```bash
kubectl get pods -o wide
NAME                       READY     STATUS    RESTARTS   AGE       IP           NODE
busybox-5858cc4697-5jc7f   1/1       Running   0          3m        10.244.1.5   k8snode-342zzth442uje-1
```

From `busybox`'s shell prompt, we can see its IP address is 10.244.1.5, subnet is 10.244.1.0/24, and MAC address is `0A:58:0A:F4:01:05`

```bash
# ifconfig
eth0      Link encap:Ethernet  HWaddr 0A:58:0A:F4:01:05  
          inet addr:10.244.1.5  Bcast:0.0.0.0  Mask:255.255.255.0
          inet6 addr: fe80::6063:d9ff:fe07:194b/64 Scope:Link
          UP BROADCAST RUNNING MULTICAST  MTU:1450  Metric:1
          RX packets:19 errors:0 dropped:0 overruns:0 frame:0
          TX packets:9 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:0 
          RX bytes:1574 (1.5 KiB)  TX bytes:766 (766.0 B)

...
```

Let's see how routing is configured inside of `busybox`, it appears 10.244.1.1 is the gateway for 16bit subnet 10.244.0.0/16.

```bash
# route
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
default         10.244.1.1      0.0.0.0         UG    0      0        0 eth0
10.244.0.0      10.244.1.1      255.255.0.0     UG    0      0        0 eth0
10.244.1.0      *               255.255.255.0   U     0      0        0 eth0
```

Here comes the question, who has the IP address 10.244.1.1, the answer is "cni0".If we run `ifconfig -a` from node k8snode-342zzth442uje-1, we can see cni0 has the IP address 10.244.1.1.

```bash
cni0      Link encap:Ethernet  HWaddr 0a:58:0a:f4:01:01  
          inet addr:10.244.1.1  Bcast:0.0.0.0  Mask:255.255.255.0
          inet6 addr: fe80::5c62:5eff:fec4:136e/64 Scope:Link
          UP BROADCAST RUNNING MULTICAST  MTU:1450  Metric:1
          RX packets:4838 errors:0 dropped:0 overruns:0 frame:0
          TX packets:5489 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1000 
          RX bytes:847131 (847.1 KB)  TX bytes:640488 (640.4 KB)
...
```

So if we ping `10.244.0.5` from `busybox`, based on `busybox`'s routing table, ICMP ping packet will be forwarded to cni0.

Then from node k8snode-342zzth442uje-1's routing table, ICMP ping packet will be forwarded to flannel.1.

```bash
route
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
...
10.244.0.0      10.244.0.0      255.255.255.0   UG    0      0        0 flannel.1
...
```

flannel.1's IP configuration is below

```bash
flannel.1 Link encap:Ethernet  HWaddr 8e:d0:f8:0a:41:19  
          inet addr:10.244.1.0  Bcast:0.0.0.0  Mask:255.255.255.255
          inet6 addr: fe80::8cd0:f8ff:fe0a:4119/64 Scope:Link
          UP BROADCAST RUNNING MULTICAST  MTU:1450  Metric:1
          RX packets:1554 errors:0 dropped:0 overruns:0 frame:0
          TX packets:1554 errors:0 dropped:73 overruns:0 carrier:0
          collisions:0 txqueuelen:0 
          RX bytes:130878 (130.8 KB)  TX bytes:129775 (129.7 KB)
```

Put it all together, we have below network devices, their IP and MAC addresses

<table><thead><tr><th>Network Device</th><th>IP Address</th><th>MAC Address</th></tr></thead><tbody><tr><td>eth0(busybox)</td><td>10.244.1.5</td><td>0a:58:0a:f4:01:05</td></tr><tr><td>veth822966d6</td><td></td><td>8a:fa:7b:db:62:3e</td></tr><tr><td>cni0</td><td>10.244.1.1</td><td>0a:58:0a:f4:01:01</td></tr><tr><td>flannel.1</td><td>10.244.1.0</td><td>8e:d0:f8:0a:41:19</td></tr><tr><td>eth0</td><td>172.16.0.5</td><td>00:0d:3a:a3:fa:d5</td></tr></tbody></table>

We will keep running ICMP ping from busybox and see how the ICMP ping packet presented from each interface

```bash
# ping 10.244.0.5
PING 10.244.0.5 (10.244.0.5): 56 data bytes
64 bytes from 10.244.0.5: seq=0 ttl=62 time=0.915 ms
64 bytes from 10.244.0.5: seq=1 ttl=62 time=0.665 ms
64 bytes from 10.244.0.5: seq=2 ttl=62 time=0.972 ms
...
```

Network trace from `tcpdump -i veth822966d6 -n -e`

```bash
tcpdump: verbose output suppressed, use -v or -vv for full protocol decode
listening on veth822966d6, link-type EN10MB (Ethernet), capture size 262144 bytes
03:49:53.612452 0a:58:0a:f4:01:05 > 0a:58:0a:f4:01:01, ethertype IPv4 (0x0800), length 98: 10.244.1.5 > 10.244.0.5: ICMP echo request, id 3584, seq 22, length 64
03:49:53.615386 0a:58:0a:f4:01:01 > 0a:58:0a:f4:01:05, ethertype IPv4 (0x0800), length 98: 10.244.0.5 > 10.244.1.5: ICMP echo reply, id 3584, seq 22, length 64
```

Network trace from `tcpdump -i cni0 -n -e "icmp"`

```bash
tcpdump: verbose output suppressed, use -v or -vv for full protocol decode
listening on cni0, link-type EN10MB (Ethernet), capture size 262144 bytes
03:51:48.765967 0a:58:0a:f4:01:05 > 0a:58:0a:f4:01:01, ethertype IPv4 (0x0800), length 98: 10.244.1.5 > 10.244.0.5: ICMP echo request, id 3584, seq 137, length 64
03:51:48.766957 0a:58:0a:f4:01:01 > 0a:58:0a:f4:01:05, ethertype IPv4 (0x0800), length 98: 10.244.0.5 > 10.244.1.5: ICMP echo reply, id 3584, seq 137, length 64
```

Network trace from `tcpdump -i flannel.1 -n -e "icmp"`

```bash
tcpdump: verbose output suppressed, use -v or -vv for full protocol decode
listening on flannel.1, link-type EN10MB (Ethernet), capture size 262144 bytes
03:52:47.857269 8e:d0:f8:0a:41:19 > 76:34:2f:c5:51:ec, ethertype IPv4 (0x0800), length 98: 10.244.1.5 > 10.244.0.5: ICMP echo request, id 3584, seq 196, length 64
03:52:47.858080 76:34:2f:c5:51:ec > 8e:d0:f8:0a:41:19, ethertype IPv4 (0x0800), length 98: 10.244.0.5 > 10.244.1.5: ICMP echo reply, id 3584, seq 196, length 64
```

Network trace from `tcpdump -i eth0 -n -e "udp"`

```bash
tcpdump: verbose output suppressed, use -v or -vv for full protocol decode
listening on eth0, link-type EN10MB (Ethernet), capture size 262144 bytes
03:56:12.054767 00:0d:3a:a3:fa:d5 > 12:34:56:78:9a:bc, ethertype IPv4 (0x0800), length 148: 172.16.0.5.38330 > 172.16.0.4.8472: OTV, flags [I] (0x08), overlay 0, instance 1
8e:d0:f8:0a:41:19 > 76:34:2f:c5:51:ec, ethertype IPv4 (0x0800), length 98: 10.244.1.5 > 10.244.0.5: ICMP echo request, id 3584, seq 400, length 64
03:56:12.055200 a0:3d:6f:01:0f:ef > 00:0d:3a:a3:fa:d5, ethertype IPv4 (0x0800), length 148: 172.16.0.4.56724 > 172.16.0.5.8472: OTV, flags [I] (0x08), overlay 0, instance 1
76:34:2f:c5:51:ec > 8e:d0:f8:0a:41:19, ethertype IPv4 (0x0800), length 98: 10.244.0.5 > 10.244.1.5: ICMP echo reply, id 3584, seq 400, length 64
```

Fullly expanded ICMP request packet captured from eth0

```bash
Frame 7: 148 bytes on wire (1184 bits), 148 bytes captured (1184 bits)
    Encapsulation type: Ethernet (1)
    Arrival Time: May 31, 2018 21:09:53.823688000 China Standard Time
    [Time shift for this packet: 0.000000000 seconds]
    Epoch Time: 1527772193.823688000 seconds
    [Time delta from previous captured frame: 0.132288000 seconds]
    [Time delta from previous displayed frame: 0.000000000 seconds]
    [Time since reference or first frame: 0.799452000 seconds]
    Frame Number: 7
    Frame Length: 148 bytes (1184 bits)
    Capture Length: 148 bytes (1184 bits)
    [Frame is marked: False]
    [Frame is ignored: False]
    [Protocols in frame: eth:ethertype:ip:udp:vxlan:eth:ethertype:ip:icmp:data]
    [Coloring Rule Name: ICMP]
    [Coloring Rule String: icmp || icmpv6]
Ethernet II, Src: Microsof_a3:fa:d5 (00:0d:3a:a3:fa:d5), Dst: 12:34:56:78:9a:bc (12:34:56:78:9a:bc)
    Destination: 12:34:56:78:9a:bc (12:34:56:78:9a:bc)
        Address: 12:34:56:78:9a:bc (12:34:56:78:9a:bc)
        .... ..1. .... .... .... .... = LG bit: Locally administered address (this is NOT the factory default)
        .... ...0 .... .... .... .... = IG bit: Individual address (unicast)
    Source: Microsof_a3:fa:d5 (00:0d:3a:a3:fa:d5)
        Address: Microsof_a3:fa:d5 (00:0d:3a:a3:fa:d5)
        .... ..0. .... .... .... .... = LG bit: Globally unique address (factory default)
        .... ...0 .... .... .... .... = IG bit: Individual address (unicast)
    Type: IPv4 (0x0800)
Internet Protocol Version 4, Src: 172.16.0.5, Dst: 172.16.0.4
    0100 .... = Version: 4
    .... 0101 = Header Length: 20 bytes (5)
    Differentiated Services Field: 0x00 (DSCP: CS0, ECN: Not-ECT)
        0000 00.. = Differentiated Services Codepoint: Default (0)
        .... ..00 = Explicit Congestion Notification: Not ECN-Capable Transport (0)
    Total Length: 134
    Identification: 0x1171 (4465)
    Flags: 0x0000
        0... .... .... .... = Reserved bit: Not set
        .0.. .... .... .... = Don't fragment: Not set
        ..0. .... .... .... = More fragments: Not set
        ...0 0000 0000 0000 = Fragment offset: 0
    Time to live: 64
    Protocol: UDP (17)
    Header checksum: 0x10cd [validation disabled]
    [Header checksum status: Unverified]
    Source: 172.16.0.5
    Destination: 172.16.0.4
User Datagram Protocol, Src Port: 38330, Dst Port: 8472
    Source Port: 38330
    Destination Port: 8472
    Length: 114
    Checksum: 0x58ad [unverified]
    [Checksum Status: Unverified]
    [Stream index: 0]
Virtual eXtensible Local Area Network
    Flags: 0x0800, VXLAN Network ID (VNI)
        0... .... .... .... = GBP Extension: Not defined
        .... .... .0.. .... = Don't Learn: False
        .... 1... .... .... = VXLAN Network ID (VNI): True
        .... .... .... 0... = Policy Applied: False
        .000 .000 0.00 .000 = Reserved(R): 0x0000
    Group Policy ID: 0
    VXLAN Network Identifier (VNI): 1
    Reserved: 0
Ethernet II, Src: 8e:d0:f8:0a:41:19 (8e:d0:f8:0a:41:19), Dst: 76:34:2f:c5:51:ec (76:34:2f:c5:51:ec)
    Destination: 76:34:2f:c5:51:ec (76:34:2f:c5:51:ec)
        Address: 76:34:2f:c5:51:ec (76:34:2f:c5:51:ec)
        .... ..1. .... .... .... .... = LG bit: Locally administered address (this is NOT the factory default)
        .... ...0 .... .... .... .... = IG bit: Individual address (unicast)
    Source: 8e:d0:f8:0a:41:19 (8e:d0:f8:0a:41:19)
        Address: 8e:d0:f8:0a:41:19 (8e:d0:f8:0a:41:19)
        .... ..1. .... .... .... .... = LG bit: Locally administered address (this is NOT the factory default)
        .... ...0 .... .... .... .... = IG bit: Individual address (unicast)
    Type: IPv4 (0x0800)
Internet Protocol Version 4, Src: 10.244.1.5, Dst: 10.244.0.5
    0100 .... = Version: 4
    .... 0101 = Header Length: 20 bytes (5)
    Differentiated Services Field: 0x00 (DSCP: CS0, ECN: Not-ECT)
        0000 00.. = Differentiated Services Codepoint: Default (0)
        .... ..00 = Explicit Congestion Notification: Not ECN-Capable Transport (0)
    Total Length: 84
    Identification: 0x2b06 (11014)
    Flags: 0x4000, Don't fragment
        0... .... .... .... = Reserved bit: Not set
        .1.. .... .... .... = Don't fragment: Set
        ..0. .... .... .... = More fragments: Not set
        ...0 0000 0000 0000 = Fragment offset: 0
    Time to live: 63
    Protocol: ICMP (1)
    Header checksum: 0xf9b1 [validation disabled]
    [Header checksum status: Unverified]
    Source: 10.244.1.5
    Destination: 10.244.0.5
Internet Control Message Protocol
    Type: 8 (Echo (ping) request)
    Code: 0
    Checksum: 0xdfbe [correct]
    [Checksum Status: Good]
    Identifier (BE): 2560 (0x0a00)
    Identifier (LE): 10 (0x000a)
    Sequence number (BE): 103 (0x0067)
    Sequence number (LE): 26368 (0x6700)
    [Response frame: 8]
    Data (56 bytes)
```

Fullly expanded ICMP reply packet captured from eth0

```bash
Frame 8: 148 bytes on wire (1184 bits), 148 bytes captured (1184 bits)
    Encapsulation type: Ethernet (1)
    Arrival Time: May 31, 2018 21:09:53.824379000 China Standard Time
    [Time shift for this packet: 0.000000000 seconds]
    Epoch Time: 1527772193.824379000 seconds
    [Time delta from previous captured frame: 0.000691000 seconds]
    [Time delta from previous displayed frame: 0.000691000 seconds]
    [Time since reference or first frame: 0.800143000 seconds]
    Frame Number: 8
    Frame Length: 148 bytes (1184 bits)
    Capture Length: 148 bytes (1184 bits)
    [Frame is marked: False]
    [Frame is ignored: False]
    [Protocols in frame: eth:ethertype:ip:udp:vxlan:eth:ethertype:ip:icmp:data]
    [Coloring Rule Name: ICMP]
    [Coloring Rule String: icmp || icmpv6]
Ethernet II, Src: Cisco_01:0f:ef (a0:3d:6f:01:0f:ef), Dst: Microsof_a3:fa:d5 (00:0d:3a:a3:fa:d5)
    Destination: Microsof_a3:fa:d5 (00:0d:3a:a3:fa:d5)
        Address: Microsof_a3:fa:d5 (00:0d:3a:a3:fa:d5)
        .... ..0. .... .... .... .... = LG bit: Globally unique address (factory default)
        .... ...0 .... .... .... .... = IG bit: Individual address (unicast)
    Source: Cisco_01:0f:ef (a0:3d:6f:01:0f:ef)
        Address: Cisco_01:0f:ef (a0:3d:6f:01:0f:ef)
        .... ..0. .... .... .... .... = LG bit: Globally unique address (factory default)
        .... ...0 .... .... .... .... = IG bit: Individual address (unicast)
    Type: IPv4 (0x0800)
Internet Protocol Version 4, Src: 172.16.0.4, Dst: 172.16.0.5
    0100 .... = Version: 4
    .... 0101 = Header Length: 20 bytes (5)
    Differentiated Services Field: 0x00 (DSCP: CS0, ECN: Not-ECT)
        0000 00.. = Differentiated Services Codepoint: Default (0)
        .... ..00 = Explicit Congestion Notification: Not ECN-Capable Transport (0)
    Total Length: 134
    Identification: 0xedfb (60923)
    Flags: 0x0000
        0... .... .... .... = Reserved bit: Not set
        .0.. .... .... .... = Don't fragment: Not set
        ..0. .... .... .... = More fragments: Not set
        ...0 0000 0000 0000 = Fragment offset: 0
    Time to live: 64
    Protocol: UDP (17)
    Header checksum: 0x3442 [validation disabled]
    [Header checksum status: Unverified]
    Source: 172.16.0.4
    Destination: 172.16.0.5
User Datagram Protocol, Src Port: 56724, Dst Port: 8472
    Source Port: 56724
    Destination Port: 8472
    Length: 114
    Checksum: 0xd758 [unverified]
    [Checksum Status: Unverified]
    [Stream index: 1]
Virtual eXtensible Local Area Network
    Flags: 0x0800, VXLAN Network ID (VNI)
        0... .... .... .... = GBP Extension: Not defined
        .... .... .0.. .... = Don't Learn: False
        .... 1... .... .... = VXLAN Network ID (VNI): True
        .... .... .... 0... = Policy Applied: False
        .000 .000 0.00 .000 = Reserved(R): 0x0000
    Group Policy ID: 0
    VXLAN Network Identifier (VNI): 1
    Reserved: 0
Ethernet II, Src: 76:34:2f:c5:51:ec (76:34:2f:c5:51:ec), Dst: 8e:d0:f8:0a:41:19 (8e:d0:f8:0a:41:19)
    Destination: 8e:d0:f8:0a:41:19 (8e:d0:f8:0a:41:19)
        Address: 8e:d0:f8:0a:41:19 (8e:d0:f8:0a:41:19)
        .... ..1. .... .... .... .... = LG bit: Locally administered address (this is NOT the factory default)
        .... ...0 .... .... .... .... = IG bit: Individual address (unicast)
    Source: 76:34:2f:c5:51:ec (76:34:2f:c5:51:ec)
        Address: 76:34:2f:c5:51:ec (76:34:2f:c5:51:ec)
        .... ..1. .... .... .... .... = LG bit: Locally administered address (this is NOT the factory default)
        .... ...0 .... .... .... .... = IG bit: Individual address (unicast)
    Type: IPv4 (0x0800)
Internet Protocol Version 4, Src: 10.244.0.5, Dst: 10.244.1.5
    0100 .... = Version: 4
    .... 0101 = Header Length: 20 bytes (5)
    Differentiated Services Field: 0x00 (DSCP: CS0, ECN: Not-ECT)
        0000 00.. = Differentiated Services Codepoint: Default (0)
        .... ..00 = Explicit Congestion Notification: Not ECN-Capable Transport (0)
    Total Length: 84
    Identification: 0xff42 (65346)
    Flags: 0x0000
        0... .... .... .... = Reserved bit: Not set
        .0.. .... .... .... = Don't fragment: Not set
        ..0. .... .... .... = More fragments: Not set
        ...0 0000 0000 0000 = Fragment offset: 0
    Time to live: 63
    Protocol: ICMP (1)
    Header checksum: 0x6575 [validation disabled]
    [Header checksum status: Unverified]
    Source: 10.244.0.5
    Destination: 10.244.1.5
Internet Control Message Protocol
    Type: 0 (Echo (ping) reply)
    Code: 0
    Checksum: 0xe7be [correct]
    [Checksum Status: Good]
    Identifier (BE): 2560 (0x0a00)
    Identifier (LE): 10 (0x000a)
    Sequence number (BE): 103 (0x0067)
    Sequence number (LE): 26368 (0x6700)
    [Request frame: 7]
    [Response time: 0.691 ms]
    Data (56 bytes)
```

## 4 Flannel UDP Mode

Flannel also supports a debugging purpose mode called UDP, refer to [Backends](https://github.com/coreos/flannel/blob/master/Documentation/backends.md)

> UDP  
> Use UDP only for debugging if your network and kernel prevent you from using VXLAN or host-gw.  
> Type and options:  
> Type (string): udp  
> Port (number): UDP port to use for sending encapsulated packets. Defaults to 8285.

### 4.1 Configure Flannel Network to UDP Mode

Here are the steps to configure Flannel in UDP mode

*   Dump Flannel configuration first

```bash
kubectl get configmaps kube-flannel-cfg -n=kube-system -o yaml > flannel-cfg.yml
```

*   Edit flannel-cfg.yml by issuing `vi flannel-cfg.yml`, modify `Backend` type to `udp` then save the file

```yaml
  net-conf.json: |
    {
      "Network": "10.244.0.0/16",
      "Backend": {
        "Type": "udp"
      }
    }
```

*   Apply new configruation to K8S

```bash
kubectl apply -f flannel-cfg.yml
```

*   Reboot all K8S nodes to apply the changes

### 4.2 Understand How Flannel UDP Mode Works

If we run `ipconfig -a` from K8S node, we could see there is no flannel.1 device anymore, instead we have a new device `flannel0` created.

```bash
cni0      Link encap:Ethernet  HWaddr 0a:58:0a:f4:01:01  
          inet addr:10.244.1.1  Bcast:0.0.0.0  Mask:255.255.255.0
          inet6 addr: fe80::8cd3:42ff:fe50:b881/64 Scope:Link
          UP BROADCAST RUNNING MULTICAST  MTU:1472  Metric:1
          RX packets:279993 errors:0 dropped:0 overruns:0 frame:0
          TX packets:313453 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1000 
          RX bytes:49042038 (49.0 MB)  TX bytes:36502523 (36.5 MB)

docker0   Link encap:Ethernet  HWaddr 02:42:e7:d9:90:ad  
          inet addr:172.17.0.1  Bcast:0.0.0.0  Mask:255.255.0.0
          UP BROADCAST MULTICAST  MTU:1500  Metric:1
          RX packets:0 errors:0 dropped:0 overruns:0 frame:0
          TX packets:0 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:0 
          RX bytes:0 (0.0 B)  TX bytes:0 (0.0 B)

eth0      Link encap:Ethernet  HWaddr 00:0d:3a:a3:fa:d5  
          inet addr:172.16.0.5  Bcast:172.16.0.255  Mask:255.255.255.0
          inet6 addr: fe80::20d:3aff:fea3:fad5/64 Scope:Link
          UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1
          RX packets:3286115 errors:0 dropped:0 overruns:0 frame:0
          TX packets:2696890 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1000 
          RX bytes:2743208258 (2.7 GB)  TX bytes:852929710 (852.9 MB)

flannel0  Link encap:UNSPEC  HWaddr 00-00-00-00-00-00-00-00-00-00-00-00-00-00-00-00  
          inet addr:10.244.1.0  P-t-P:10.244.1.0  Mask:255.255.0.0
          inet6 addr: fe80::92dc:d0db:d2b6:f5e8/64 Scope:Link
          UP POINTOPOINT RUNNING NOARP MULTICAST  MTU:1472  Metric:1
          RX packets:45 errors:0 dropped:0 overruns:0 frame:0
          TX packets:122 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:500 
          RX bytes:3836 (3.8 KB)  TX bytes:7476 (7.4 KB)

...
```

Flannel0 is a TUN device created by our flanneld daemon process, TUN device provides packet reception and transmission for user space programs. It can be seen as a simple Point-to-Point or Ethernet device, which, instead of receiving packets from physical media, receives them from user space program and instead of sending packets via physical media writes them to the user space program. Which means in UDP mode, `flanneld` is the user space program that will wrap the packet send it over to eth0 device/unwrap the packet received from the eth0. Run `ip -d link show flannel0` to get the detailed infromation of `flannel0`.

```bash
4: flannel0: <POINTOPOINT,MULTICAST,NOARP,UP,LOWER_UP> mtu 1472 qdisc pfifo_fast state UNKNOWN mode DEFAULT group default qlen 500
    link/none  promiscuity 0 
    tun 
```

The difference between `flannel0` and `flannel.1` is also in the IP address assignment, `flannel0` has a 16bit netmask while `flannel.1` has a 32bit netmask. Following result is from `ifconfig flannel0`, as you can see, `flannel0` is using 255.255.0.0 as netmask.

```bash
flannel0  Link encap:UNSPEC  HWaddr 00-00-00-00-00-00-00-00-00-00-00-00-00-00-00-00  
          inet addr:10.244.1.0  P-t-P:10.244.1.0  Mask:255.255.0.0
          inet6 addr: fe80::92dc:d0db:d2b6:f5e8/64 Scope:Link
          UP POINTOPOINT RUNNING NOARP MULTICAST  MTU:1472  Metric:1
          RX packets:45 errors:0 dropped:0 overruns:0 frame:0
          TX packets:122 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:500 
          RX bytes:3836 (3.8 KB)  TX bytes:7476 (7.4 KB)
```

Host node routing table also has a slight difference, `route` shows 10.244.0.0/16 routing table entry in udp mode while vxlan it is using 10.244.0.0/24 (host node subnet routing)

```bash
ernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
default         172.16.0.1      0.0.0.0         UG    0      0        0 eth0
10.244.0.0      *               255.255.0.0     U     0      0        0 flannel0
10.244.1.0      *               255.255.255.0   U     0      0        0 cni0
168.63.129.16   172.16.0.1      255.255.255.255 UGH   0      0        0 eth0
169.254.169.254 172.16.0.1      255.255.255.255 UGH   0      0        0 eth0
172.16.0.0      *               255.255.255.0   U     0      0        0 eth0
172.17.0.0      *               255.255.0.0     U     0      0        0 docker0
```

### 4.3 How flannel0 wrap the packet in UDP

Let's capture a network trace to see how packet gets wrapped in udp mode, from node k8snode-342zzth442uje-1, run below command  
`tcpdump -i eth0 -s 65535 -w flannel_udp.cap "udp"`

Using wireshark to decode the UDP data as IP packet, we can see below result

*   ICMP ping request

```bash
Frame 59: 126 bytes on wire (1008 bits), 126 bytes captured (1008 bits)
    Encapsulation type: Ethernet (1)
    Arrival Time: Jun  4, 2018 15:47:23.058527000 China Standard Time
    [Time shift for this packet: 0.000000000 seconds]
    Epoch Time: 1528098443.058527000 seconds
    [Time delta from previous captured frame: 0.321470000 seconds]
    [Time delta from previous displayed frame: 0.999498000 seconds]
    [Time since reference or first frame: 2.731338000 seconds]
    Frame Number: 59
    Frame Length: 126 bytes (1008 bits)
    Capture Length: 126 bytes (1008 bits)
    [Frame is marked: False]
    [Frame is ignored: False]
    [Protocols in frame: eth:ethertype:ip:udp:ip:icmp:data]
    [Coloring Rule Name: ICMP]
    [Coloring Rule String: icmp || icmpv6]
Ethernet II, Src: Microsof_a3:fa:d5 (00:0d:3a:a3:fa:d5), Dst: 12:34:56:78:9a:bc (12:34:56:78:9a:bc)
    Destination: 12:34:56:78:9a:bc (12:34:56:78:9a:bc)
        Address: 12:34:56:78:9a:bc (12:34:56:78:9a:bc)
        .... ..1. .... .... .... .... = LG bit: Locally administered address (this is NOT the factory default)
        .... ...0 .... .... .... .... = IG bit: Individual address (unicast)
    Source: Microsof_a3:fa:d5 (00:0d:3a:a3:fa:d5)
        Address: Microsof_a3:fa:d5 (00:0d:3a:a3:fa:d5)
        .... ..0. .... .... .... .... = LG bit: Globally unique address (factory default)
        .... ...0 .... .... .... .... = IG bit: Individual address (unicast)
    Type: IPv4 (0x0800)
Internet Protocol Version 4, Src: 172.16.0.5, Dst: 172.16.0.4
    0100 .... = Version: 4
    .... 0101 = Header Length: 20 bytes (5)
    Differentiated Services Field: 0x00 (DSCP: CS0, ECN: Not-ECT)
        0000 00.. = Differentiated Services Codepoint: Default (0)
        .... ..00 = Explicit Congestion Notification: Not ECN-Capable Transport (0)
    Total Length: 112
    Identification: 0x3db7 (15799)
    Flags: 0x4000, Don't fragment
        0... .... .... .... = Reserved bit: Not set
        .1.. .... .... .... = Don't fragment: Set
        ..0. .... .... .... = More fragments: Not set
        ...0 0000 0000 0000 = Fragment offset: 0
    Time to live: 64
    Protocol: UDP (17)
    Header checksum: 0xa49c [validation disabled]
    [Header checksum status: Unverified]
    Source: 172.16.0.5
    Destination: 172.16.0.4
User Datagram Protocol, Src Port: 8285, Dst Port: 8285
    Source Port: 8285
    Destination Port: 8285
    Length: 92
    Checksum: 0x5897 [unverified]
    [Checksum Status: Unverified]
    [Stream index: 0]
Internet Protocol Version 4, Src: 10.244.1.14, Dst: 10.244.0.6
    0100 .... = Version: 4
    .... 0101 = Header Length: 20 bytes (5)
    Differentiated Services Field: 0x00 (DSCP: CS0, ECN: Not-ECT)
        0000 00.. = Differentiated Services Codepoint: Default (0)
        .... ..00 = Explicit Congestion Notification: Not ECN-Capable Transport (0)
    Total Length: 84
    Identification: 0x3fd8 (16344)
    Flags: 0x4000, Don't fragment
        0... .... .... .... = Reserved bit: Not set
        .1.. .... .... .... = Don't fragment: Set
        ..0. .... .... .... = More fragments: Not set
        ...0 0000 0000 0000 = Fragment offset: 0
    Time to live: 62
    Protocol: ICMP (1)
    Header checksum: 0xe5d5 [validation disabled]
    [Header checksum status: Unverified]
    Source: 10.244.1.14
    Destination: 10.244.0.6
Internet Control Message Protocol
    Type: 8 (Echo (ping) request)
    Code: 0
    Checksum: 0x451d [correct]
    [Checksum Status: Good]
    Identifier (BE): 1536 (0x0600)
    Identifier (LE): 6 (0x0006)
    Sequence number (BE): 32 (0x0020)
    Sequence number (LE): 8192 (0x2000)
    [Response frame: 60]
    Data (56 bytes)
```

ICMP ping reply

```bash
Frame 60: 126 bytes on wire (1008 bits), 126 bytes captured (1008 bits)
    Encapsulation type: Ethernet (1)
    Arrival Time: Jun  4, 2018 15:47:23.059315000 China Standard Time
    [Time shift for this packet: 0.000000000 seconds]
    Epoch Time: 1528098443.059315000 seconds
    [Time delta from previous captured frame: 0.000788000 seconds]
    [Time delta from previous displayed frame: 0.000788000 seconds]
    [Time since reference or first frame: 2.732126000 seconds]
    Frame Number: 60
    Frame Length: 126 bytes (1008 bits)
    Capture Length: 126 bytes (1008 bits)
    [Frame is marked: False]
    [Frame is ignored: False]
    [Protocols in frame: eth:ethertype:ip:udp:ip:icmp:data]
    [Coloring Rule Name: ICMP]
    [Coloring Rule String: icmp || icmpv6]
Ethernet II, Src: Cisco_01:0f:ef (a0:3d:6f:01:0f:ef), Dst: Microsof_a3:fa:d5 (00:0d:3a:a3:fa:d5)
    Destination: Microsof_a3:fa:d5 (00:0d:3a:a3:fa:d5)
        Address: Microsof_a3:fa:d5 (00:0d:3a:a3:fa:d5)
        .... ..0. .... .... .... .... = LG bit: Globally unique address (factory default)
        .... ...0 .... .... .... .... = IG bit: Individual address (unicast)
    Source: Cisco_01:0f:ef (a0:3d:6f:01:0f:ef)
        Address: Cisco_01:0f:ef (a0:3d:6f:01:0f:ef)
        .... ..0. .... .... .... .... = LG bit: Globally unique address (factory default)
        .... ...0 .... .... .... .... = IG bit: Individual address (unicast)
    Type: IPv4 (0x0800)
Internet Protocol Version 4, Src: 172.16.0.4, Dst: 172.16.0.5
    0100 .... = Version: 4
    .... 0101 = Header Length: 20 bytes (5)
    Differentiated Services Field: 0x00 (DSCP: CS0, ECN: Not-ECT)
        0000 00.. = Differentiated Services Codepoint: Default (0)
        .... ..00 = Explicit Congestion Notification: Not ECN-Capable Transport (0)
    Total Length: 112
    Identification: 0x4cbe (19646)
    Flags: 0x4000, Don't fragment
        0... .... .... .... = Reserved bit: Not set
        .1.. .... .... .... = Don't fragment: Set
        ..0. .... .... .... = More fragments: Not set
        ...0 0000 0000 0000 = Fragment offset: 0
    Time to live: 64
    Protocol: UDP (17)
    Header checksum: 0x9595 [validation disabled]
    [Header checksum status: Unverified]
    Source: 172.16.0.4
    Destination: 172.16.0.5
User Datagram Protocol, Src Port: 8285, Dst Port: 8285
    Source Port: 8285
    Destination Port: 8285
    Length: 92
    Checksum: 0x6652 [unverified]
    [Checksum Status: Unverified]
    [Stream index: 0]
Internet Protocol Version 4, Src: 10.244.0.6, Dst: 10.244.1.14
    0100 .... = Version: 4
    .... 0101 = Header Length: 20 bytes (5)
    Differentiated Services Field: 0x00 (DSCP: CS0, ECN: Not-ECT)
        0000 00.. = Differentiated Services Codepoint: Default (0)
        .... ..00 = Explicit Congestion Notification: Not ECN-Capable Transport (0)
    Total Length: 84
    Identification: 0xd317 (54039)
    Flags: 0x0000
        0... .... .... .... = Reserved bit: Not set
        .0.. .... .... .... = Don't fragment: Not set
        ..0. .... .... .... = More fragments: Not set
        ...0 0000 0000 0000 = Fragment offset: 0
    Time to live: 62
    Protocol: ICMP (1)
    Header checksum: 0x9296 [validation disabled]
    [Header checksum status: Unverified]
    Source: 10.244.0.6
    Destination: 10.244.1.14
Internet Control Message Protocol
    Type: 0 (Echo (ping) reply)
    Code: 0
    Checksum: 0x4d1d [correct]
    [Checksum Status: Good]
    Identifier (BE): 1536 (0x0600)
    Identifier (LE): 6 (0x0006)
    Sequence number (BE): 32 (0x0020)
    Sequence number (LE): 8192 (0x2000)
    [Request frame: 59]
    [Response time: 0.788 ms]
    Data (56 bytes)
```

## 5 Flannel 'host-gw' Mode

In this mode, flannel simply configures each host node as a gateway and replies on routing table to route the traffics between Pod network and host. There will be no 'flannel.1' or `flannel0` interface created, all traffics are routed from `eth0` interface.

```bash
cni0      Link encap:Ethernet  HWaddr 0a:58:0a:f4:01:01  
          inet addr:10.244.1.1  Bcast:0.0.0.0  Mask:255.255.255.0
          inet6 addr: fe80::706e:16ff:feb3:d611/64 Scope:Link
          UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1
          RX packets:5714 errors:0 dropped:0 overruns:0 frame:0
          TX packets:5686 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1000 
          RX bytes:927660 (927.6 KB)  TX bytes:660171 (660.1 KB)

docker0   Link encap:Ethernet  HWaddr 02:42:b1:69:82:a9  
          inet addr:172.17.0.1  Bcast:0.0.0.0  Mask:255.255.0.0
          UP BROADCAST MULTICAST  MTU:1500  Metric:1
          RX packets:0 errors:0 dropped:0 overruns:0 frame:0
          TX packets:0 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:0 
          RX bytes:0 (0.0 B)  TX bytes:0 (0.0 B)

eth0      Link encap:Ethernet  HWaddr 00:0d:3a:a3:fa:d5  
          inet addr:172.16.0.5  Bcast:172.16.0.255  Mask:255.255.255.0
          inet6 addr: fe80::20d:3aff:fea3:fad5/64 Scope:Link
          UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1
          RX packets:62962 errors:0 dropped:0 overruns:0 frame:0
          TX packets:50882 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1000 
          RX bytes:52712586 (52.7 MB)  TX bytes:15592086 (15.5 MB)

lo        Link encap:Local Loopback  
          inet addr:127.0.0.1  Mask:255.0.0.0
          inet6 addr: ::1/128 Scope:Host
          UP LOOPBACK RUNNING  MTU:65536  Metric:1
          RX packets:162 errors:0 dropped:0 overruns:0 frame:0
          TX packets:162 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1000 
          RX bytes:11940 (11.9 KB)  TX bytes:11940 (11.9 KB)

veth0edd4b41 Link encap:Ethernet  HWaddr 86:d9:82:60:45:7b  
          inet6 addr: fe80::84d9:82ff:fe60:457b/64 Scope:Link
          UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1
          RX packets:4892 errors:0 dropped:0 overruns:0 frame:0
          TX packets:5591 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:0 
          RX bytes:928980 (928.9 KB)  TX bytes:651249 (651.2 KB)

veth1bcc16bd Link encap:Ethernet  HWaddr ca:46:7d:58:6d:8b  
          inet6 addr: fe80::c846:7dff:fe58:6d8b/64 Scope:Link
          UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1
          RX packets:822 errors:0 dropped:0 overruns:0 frame:0
          TX packets:213 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:0 
          RX bytes:78676 (78.6 KB)  TX bytes:17870 (17.8 KB)
```

If the cluster is created under cloud environment, cloud provider also needs to make sure each node is acting as a gateway. For example, if we want to make it work from Azure environment, we also need to enable IP forwarding from each NIC attached to host node  
![azure-flannel-ipforwarding](/assets/posts/flannel-networking-demystify/azure-flannel-ipforwarding.jpg)

UDR also need to be configured(UDR will be automatically created with Azure kubernetes cloud provider) like below  
![azure-flannel-udr](/assets/posts/flannel-networking-demystify/azure-flannel-udr.jpg)

From each node, the routing table will be set to below, we can see for each 10.244.0.0/24 subnet, there will be a specific routing table entry to route the traffics to each host `10.244.0.0 172.16.0.4 255.255.255.0 UG 0 0 0 eth0` through eth0 interface.

```bash
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
default         172.16.0.1      0.0.0.0         UG    0      0        0 eth0
10.244.0.0      172.16.0.4      255.255.255.0   UG    0      0        0 eth0
10.244.1.0      *               255.255.255.0   U     0      0        0 cni0
168.63.129.16   172.16.0.1      255.255.255.255 UGH   0      0        0 eth0
169.254.169.254 172.16.0.1      255.255.255.255 UGH   0      0        0 eth0
172.16.0.0      *               255.255.255.0   U     0      0        0 eth0
172.17.0.0      *               255.255.0.0     U     0      0        0 docker0
```

Let's attach to busybox

```bash
kubectl attach busybox-5858cc4697-5jc7f -c busybox -i -t
```

And ping `10.244.0.7`

```bash
PING 10.244.0.7 (10.244.0.7): 56 data bytes
64 bytes from 10.244.0.7: seq=0 ttl=62 time=1.715 ms
64 bytes from 10.244.0.7: seq=1 ttl=62 time=0.686 ms
64 bytes from 10.244.0.7: seq=2 ttl=62 time=0.889 ms
...
```

If we capture a network trace from `eth0` interface by issuing `tcpdump -i eth0 -n -e "icmp or arp"`, we can see the traffics are below

```bash
tcpdump: verbose output suppressed, use -v or -vv for full protocol decode
listening on eth0, link-type EN10MB (Ethernet), capture size 262144 bytes
01:32:20.355486 00:0d:3a:a3:fa:d5 > 12:34:56:78:9a:bc, ethertype IPv4 (0x0800), length 98: 10.244.1.16 > 10.244.0.7: ICMP echo request, id 1536, seq 39, length 64
01:32:20.356255 a0:3d:6f:01:0f:ef > 00:0d:3a:a3:fa:d5, ethertype IPv4 (0x0800), length 98: 10.244.0.7 > 10.244.1.16: ICMP echo reply, id 1536, seq 39, length 64
01:32:21.355645 00:0d:3a:a3:fa:d5 > 12:34:56:78:9a:bc, ethertype IPv4 (0x0800), length 98: 10.244.1.16 > 10.244.0.7: ICMP echo request, id 1536, seq 40, length 64
01:32:21.356351 a0:3d:6f:01:0f:ef > 00:0d:3a:a3:fa:d5, ethertype IPv4 (0x0800), length 98: 10.244.0.7 > 10.244.1.16: ICMP echo reply, id 1536, seq 40, length 64
```

## 6 Flannel Configuration in ETCD

Flannel stores its configuration in ETCD or from APIServer to ETCD, in either case, we can directly access ETCD to dump Flannel's configuration

Here are the steps

*   Attach to etcd container from kubectl

```bash
kubectl exec -it etcd-k8snode-342zzth442uje-0 -n=kube-system -- /bin/sh
```

Dump flannel's configuration

```bash
ETCDCTL_API=3 etcdctl --key /etc/kubernetes/pki/etcd/peer.key --cert /etc/kubernetes/pki/etcd/peer.crt --cacert /etc/kubernetes/pki/etcd/ca.crt --endpoints=https://localhost:2379 get /registry/configmaps/kube-system/kube-flannel-cfg
```

The result will be like

```bash
/registry/configmaps/kube-system/kube-flannel-cfg
k8s

v1	ConfigMap	
 
kube-flannel-cfg 
                kube-system"*$d6b253a4-535a-11e8-94dd-000d3aa3fc012ȊՐZ
appflannelZ

tiernodeb 
0kubectl.kubernetes.io/last-applied-configurationۄ{"apiVersion":"v1","data":{"cni-conf.json":"{\n  \"name\": \"cbr0\",\n  \"plugins\": [\n    {\n      \"type\": \"flannel\",\n      \"delegate\": {\n        \"hairpinMode\": true,\n        \"isDefaultGateway\": true\n      }\n    },\n    {\n      \"type\": \"portmap\",\n      \"capabilities\": {\n        \"portMappings\": true\n      }\n    }\n  ]\n}\n","net-conf.json":"{\n  \"Network\": \"10.244.0.0/16\",\n  \"Backend\": {\n    \"Type\": \"udp\"\n  }\n}\n"},"kind":"ConfigMap","metadata":{"annotations":{},"labels":{"app":"flannel","tier":"node"},"name":"kube-flannel-cfg","namespace":"kube-system"}}
z 
cni-conf.json{
  "name": "cbr0",
  "plugins": [
    {
      "type": "flannel",
      "delegate": {
        "hairpinMode": true,
        "isDefaultGateway": true
      }
    },
    {
      "type": "portmap",
      "capabilities": {
        "portMappings": true
      }
    }
  ]
}
X
net-conf.json{
  "Network": "10.244.0.0/16",
  "Backend": {
    "Type": "udp"
  }
}
"
```
