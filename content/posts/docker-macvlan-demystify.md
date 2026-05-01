---
title: "Docker Macvlan Demystify"
slug: "docker-macvlan-demystify"
date: "2018-05-25 10:42:11"
updated: "2018-05-28 13:04:28"
type: "post"
status: "published"
visibility: "public"
featured: true
excerpt: ""
feature_image: "/assets/posts/docker-macvlan-demystify/hero.jpg"
authors: ["Yingting Huang"]
tags: ["Macvlan", "Docker", "Ubuntu", "Linux"]
---
In this article, we are going to disucss a little bit about `Macvlan` and setup a `Macvlan` lab environment under Hyper-V host with 3 Ubuntu 16.04 VMs.

## 0 What is Macvlan

Refer to [Macvlan Driver](https://github.com/docker/libnetwork/blob/master/docs/macvlan.md)

> **The `Macvlan` driver provides operators the ability to integrate Docker networking in a simple and lightweight fashion into the underlying network**. `Macvlan` is supported by the Linux kernel and is a well known Linux network type. The Macvlan built-in driver does not require any port mapping and supports VLAN trunking (Virtual Local Area Network). VLANs are a traditional method of network virtualization and layer 2 datapath isolation that is prevalent in some form or fashion in most data centers.

Refer to [Use Macvlan networks](https://docs.docker.com/network/macvlan/)

> Some applications, especially legacy applications or applications which monitor network traffic, expect to be directly connected to the physical network. **In this type of situation, you can use the `macvlan` network driver to assign a MAC address to each container’s virtual network interface, making it appear to be a physical network interface directly connected to the physical network.** In this case, you need to designate a physical interface on your Docker host to use for the Macvlan, as well as the subnet and gateway of the Macvlan.

## 1 Macvlan Lab Environment

To illustrate how `Macvlan` works, we will use 3 VMs to demostrate `Macvlan`, one VM is master VM which will severs as gateway to route VLAN traffics between VLAN's sub-interfaces, other 2 VMs are docker nodes, node0 and node1. Those VMs will be created under Hyper-V environment.

### 1.1 Network Diagram

![MACVLAN](/assets/posts/docker-macvlan-demystify/macvlan.svg)  
Refer to above diagram, each VM will have two network interfaces, eth0 is for management, eth1 is the interface to create `Macvlan`

### 1.2 Hyper-V network & VM's configuration

Before creating those VMs, we need to create two virtual switches under Hyper-V. One is for management, eth0's network (has internet connectivity to download/install docker, able to SSH etc.), Another is for `Macvlan`, eth1's network.

From Powershell window, add two virtual switches

```Powershell
# eth0
New-VMSwitch -SwitchName "NAT" -SwitchType Internal
# eth1
New-VMSwitch -SwitchName "VLAN" -SwitchType Internal
```

Configure virtual switch 'NAT' in NAT mode. We need ifIndex to associate it with NAT network

```Powershell
Get-NetAdapter
```

vEthernet(NAT)'s ifIndex is `11`

```
Name                      InterfaceDescription                    ifIndex Status       MacAddress             LinkSpeed
----                      --------------------                    ------- ------       ----------             ---------
vEthernet (VLAN)          Hyper-V Virtual Ethernet Adapter #4          35 Up           00-15-5D-10-31-10        10 Gbps
vEthernet (NAT)           Hyper-V Virtual Ethernet Adapter #3          11 Up           00-15-5D-10-31-0F        10 Gbps
```

Create NAT network and associate it with 'NAT' virtual switch

```Powershell
New-NetIPAddress -IPAddress 172.16.0.1 -PrefixLength 16 -InterfaceIndex 11
New-NetNat -Name NATNetwork -InternalIPInterfaceAddressPrefix 172.16.0.0/16
```

Now, from Hyper-V management console, create three VMs with name "master", "node0" and "node1", assign fist 'Network Adatper" to 'NAT' virtual switch.

After VMs are created, we will add second 'Network Adapter' to them. Before that, let's talk a little bit about Hyper-V virtual switch mode.

Hyper-V virtual switch works in either Access mode or Trunk mode, the default mode is Access mode.

**Trunk Mode**, virtual switch will listen to all the network traffic and forward the traffic to all the ports. In other words, network packets are sent to all the virtual machines connected to it. Which means the virtual switch receives all network packets and forwards them to all the virtual machines connected to it.

**Access Mode**, virtual switch receives network packets in which it first checks the VLAN ID tagged in the network packet. If the VLAN ID tagged in the network packet matches the one configured on the virtual switch, then the network packet is accepted by the virtual switch. Any incoming network packet that is not tagged with the same VLAN ID will be discarded by the virtual switch.

Since `Macvlan` is implemented in guest OS, that means Hyper-V virtual switch needs to forward VLAN traffics to guest OS, which also means we need to configure trunk mode for second network adapter connect to virtual switch 'VLAN'. Follow below steps to add network adapter into each VM and configure them in trunk mode

```Powershell
Add-VMNetworkAdapter -SwitchName VLAN -VMName "node0" -Name "VLAN-Nic"
Set-VMNetworkAdapterVlan -Trunk -AllowedVlanIdList "10,20,30,40,50,60" -VMName "node0" -V
MNetworkAdapterName "VLAN-NIC" -NativeVlanId 100

Add-VMNetworkAdapter -SwitchName VLAN -VMName "node1" -Name "VLAN-Nic"
Set-VMNetworkAdapterVlan -Trunk -AllowedVlanIdList "10,20,30,40,50,60" -VMName "node1" -V
MNetworkAdapterName "VLAN-NIC" -NativeVlanId 100

Add-VMNetworkAdapter -SwitchName VLAN -VMName "master" -Name "VLAN-Nic"
Set-VMNetworkAdapterVlan -Trunk -AllowedVlanIdList "10,20,30,40,50,60" -VMName "master" -
VMNetworkAdapterName "VLAN-NIC" -NativeVlanId 100
```

`Macvlan` uses a unique MAC address per ethernet interface, by default, Hyper-V only allows traffics with MAC address sticks to the virutal switch port, we need to "Enable MAC address spoofing" to prevent virtual switch dropping VLAN's traffic.  
![address-spoofing](/assets/posts/docker-macvlan-demystify/address-spoofing.jpg)

### 1.3 Install Ubuntu

Install Ubuntu 16.04 on master, node0 and node1, manually configure eth0 with IP addresses below

#### 1.3.1 master

```bash
auto eth0
iface eth0 inet static
address 172.16.0.3
netmask 255.255.0.0
gateway 172.16.0.1
dns-nameservers 10.50.50.50 10.50.10.50

auto eth1
iface eth1 inet manual
```

#### 1.3.2 node0

```bash
auto eth0
iface eth0 inet static
address 172.16.0.4
netmask 255.255.0.0
gateway 172.16.0.1
dns-nameservers 10.50.50.50 10.50.10.50

auto eth1
iface eth1 inet manual
```

#### 1.3.3 node1

```bash
auto eth0
iface eth0 inet static
address 172.16.0.5
netmask 255.255.0.0
gateway 172.16.0.1
dns-nameservers 10.50.50.50 10.50.10.50

auto eth1
iface eth1 inet manual
```

On 3 VMs, run

```bash
sudo -i
apt update
apt install docker.io
```

## 2 Configure Macvlan

We are going to configure eth1 interface as an IEEE 802.1Q VLAN trunk interface.

There are two ways to connect a ethernet interface to a switch that carries 802.1Q VLANs:

*   Via a untagged port, where VLAN support is handled by the switch (so the attached machine sees ordinary Ethernet frames);  
    Or
*   Via a tagged (trunk) port, where VLAN support is handled by the attached ethernet interface (which sees 802.1Q-encapsulated Ethernet frames).

The advantage of a tagged port is that it allows multiple VLANs to be carried by a single physical bearer. The disadvantage is that the ethernet interface in question must support 801.q and be configured to use it.

VLAN requies 802.1Q kernel module, to load 802.1Q kernel module, from master, node0 and node1, run below commands

```bash
sudo -i
apt install vlan
modprobe 8021q
```

From node0 and node1, create 2 VLANs with VLAN ID 10 and 20, we will configure VLAN on master later(to show how VLAN routing works).

```bash
vconfig add eth1 10
vconfig add eth1 20
ifconfig eth1.10 up
ifconfig eth1.20 up
```

If we run `ifconfig -a` on node0 and node1, we would see below result

node0

```bash
docker0   Link encap:Ethernet  HWaddr 02:42:5d:2e:ef:f3  
          inet addr:172.17.0.1  Bcast:0.0.0.0  Mask:255.255.0.0
          UP BROADCAST MULTICAST  MTU:1500  Metric:1
          RX packets:0 errors:0 dropped:0 overruns:0 frame:0
          TX packets:0 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:0 
          RX bytes:0 (0.0 B)  TX bytes:0 (0.0 B)

eth0      Link encap:Ethernet  HWaddr 00:15:5d:10:31:07  
          inet addr:172.16.0.4  Bcast:172.16.255.255  Mask:255.255.0.0
          inet6 addr: fe80::215:5dff:fe10:3107/64 Scope:Link
          UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1
          RX packets:90852 errors:0 dropped:0 overruns:0 frame:0
          TX packets:32235 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1000 
          RX bytes:68965196 (68.9 MB)  TX bytes:4056047 (4.0 MB)

eth1      Link encap:Ethernet  HWaddr 00:15:5d:10:31:15  
          inet6 addr: fe80::215:5dff:fe10:3115/64 Scope:Link
          UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1
          RX packets:68364 errors:0 dropped:0 overruns:0 frame:0
          TX packets:40843 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1000 
          RX bytes:15163085 (15.1 MB)  TX bytes:1860806 (1.8 MB)

eth1.10   Link encap:Ethernet  HWaddr 00:15:5d:10:31:15  
          inet6 addr: fe80::215:5dff:fe10:3115/64 Scope:Link
          UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1
          RX packets:882 errors:0 dropped:0 overruns:0 frame:0
          TX packets:40712 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1000 
          RX bytes:66664 (66.6 KB)  TX bytes:1849808 (1.8 MB)

eth1.20   Link encap:Ethernet  HWaddr 00:15:5d:10:31:15  
          inet6 addr: fe80::215:5dff:fe10:3115/64 Scope:Link
          UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1
          RX packets:145 errors:0 dropped:0 overruns:0 frame:0
          TX packets:121 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1000 
          RX bytes:9512 (9.5 KB)  TX bytes:10178 (10.1 KB)

lo        Link encap:Local Loopback  
          inet addr:127.0.0.1  Mask:255.0.0.0
          inet6 addr: ::1/128 Scope:Host
          UP LOOPBACK RUNNING  MTU:65536  Metric:1
          RX packets:160 errors:0 dropped:0 overruns:0 frame:0
          TX packets:160 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1 
          RX bytes:11840 (11.8 KB)  TX bytes:11840 (11.8 KB)
```

node1

```bash
docker0   Link encap:Ethernet  HWaddr 02:42:b2:6b:03:e5  
          inet addr:172.17.0.1  Bcast:0.0.0.0  Mask:255.255.0.0
          UP BROADCAST MULTICAST  MTU:1500  Metric:1
          RX packets:0 errors:0 dropped:0 overruns:0 frame:0
          TX packets:0 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:0 
          RX bytes:0 (0.0 B)  TX bytes:0 (0.0 B)

eth0      Link encap:Ethernet  HWaddr 00:15:5d:10:31:08  
          inet addr:172.16.0.5  Bcast:172.16.255.255  Mask:255.255.0.0
          inet6 addr: fe80::215:5dff:fe10:3108/64 Scope:Link
          UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1
          RX packets:87256 errors:0 dropped:0 overruns:0 frame:0
          TX packets:27809 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1000 
          RX bytes:69339085 (69.3 MB)  TX bytes:2333610 (2.3 MB)

eth1      Link encap:Ethernet  HWaddr 00:15:5d:10:31:16  
          inet6 addr: fe80::215:5dff:fe10:3116/64 Scope:Link
          UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1
          RX packets:106266 errors:0 dropped:0 overruns:0 frame:0
          TX packets:1140 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1000 
          RX bytes:16748384 (16.7 MB)  TX bytes:86416 (86.4 KB)

eth1.10   Link encap:Ethernet  HWaddr 00:15:5d:10:31:16  
          inet6 addr: fe80::215:5dff:fe10:3116/64 Scope:Link
          UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1
          RX packets:38604 errors:0 dropped:0 overruns:0 frame:0
          TX packets:856 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1000 
          RX bytes:1106876 (1.1 MB)  TX bytes:60624 (60.6 KB)

eth1.20   Link encap:Ethernet  HWaddr 00:15:5d:10:31:16  
          inet6 addr: fe80::215:5dff:fe10:3116/64 Scope:Link
          UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1
          RX packets:322 errors:0 dropped:0 overruns:0 frame:0
          TX packets:274 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1000 
          RX bytes:23148 (23.1 KB)  TX bytes:24972 (24.9 KB)

lo        Link encap:Local Loopback  
          inet addr:127.0.0.1  Mask:255.0.0.0
          inet6 addr: ::1/128 Scope:Host
          UP LOOPBACK RUNNING  MTU:65536  Metric:1
          RX packets:522 errors:0 dropped:0 overruns:0 frame:0
          TX packets:522 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1 
          RX bytes:52384 (52.3 KB)  TX bytes:52384 (52.3 KB)
```

**Note: eth1, eth1.10 and eth1.20's `HWaddr`, they are all same**

From node0, create 2 `Macvla`n netowrks, each `Macvlan` will have 2 containers running under that VLAN, VLAN eth1.10's IP range is 192.168.2.0/24 and VLAN eth1.20's IP range is 192.169.2.0/24

```bash
# First Macvlan network on VLAN eth1.10
docker network  create  -d macvlan --subnet=192.168.0.0/16 --ip-range=192.168.2.0/24 -o macvlan_mode=bridge -o parent=eth1.10 macvlan10

docker run --net=macvlan10 -itd --name macvlan10_1 busybox
docker run --net=macvlan10 -itd --name macvlan10_2 busybox

# Second Macvlan network on eth1.20
docker network  create  -d macvlan --subnet=192.169.0.0/16 --ip-range=192.169.2.0/24 -o macvlan_mode=bridge -o parent=eth1.20 macvlan20
docker run --net=macvlan20 -itd --name macvlan20_1 busybox
docker run --net=macvlan20 -itd --name macvlan20_2 busybox
```

From node1, create 2 `Macvla`n netowrks, each `Macvlan` will have 2 containers running under that VLAN, VLAN eth1.10's IP range is 192.168.3.0/24 and VLAN eth1.20's IP range is 192.169.3.0/24

```bash
# First Macvlan network on VLAN eth1.10
docker network  create  -d macvlan --subnet=192.168.0.0/16 --ip-range=192.168.3.0/24 -o macvlan_mode=bridge -o parent=eth1.10 macvlan10
docker run --net=macvlan10 -itd --name macvlan10_3 busybox
docker run --net=macvlan10 -itd --name macvlan10_4 busybox

# Second Macvlan network on VLAN eth1.20
docker network  create  -d macvlan --subnet=192.169.0.0/16 --ip-range=192.169.3.0/24 -o macvlan_mode=bridge -o parent=eth1.20 macvlan20
docker run --net=macvlan20 -itd --name macvlan20_3 busybox
docker run --net=macvlan20 -itd --name macvlan20_4 busybox
```

Now, we have finished `Macvlan` setup and we are going to test the network connectivity in next section.

## 3 Test Macvlan's Network Connectivity

We now have 2 Macvlan networks, and 8 containers are running on 2 nodes

<table><thead><tr><th>Node</th><th>Macvlan</th><th>Container</th><th>IP Address</th></tr></thead><tbody><tr><td>node0</td><td>macvlan10</td><td>macvlan10_1</td><td>192.168.2.1</td></tr><tr><td>node0</td><td>macvlan10</td><td>macvlan10_2</td><td>192.168.2.2</td></tr><tr><td>node0</td><td>macvlan20</td><td>macvlan20_1</td><td>192.169.2.1</td></tr><tr><td>node0</td><td>macvlan20</td><td>macvlan20_2</td><td>192.169.2.2</td></tr><tr><td>node1</td><td>macvlan10</td><td>macvlan10_3</td><td>192.168.3.1</td></tr><tr><td>node1</td><td>macvlan10</td><td>macvlan10_4</td><td>192.168.3.2</td></tr><tr><td>node1</td><td>macvlan20</td><td>macvlan20_3</td><td>192.169.3.1</td></tr><tr><td>node1</td><td>macvlan20</td><td>macvlan20_4</td><td>192.169.3.2</td></tr></tbody></table>

We are going to show how `Macvlan` works by running simple ICMP ping commands.

From node0, run `docker ps`, it shows we have 4 containers are running right now

```bash
CONTAINER ID        IMAGE               COMMAND             CREATED             STATUS              PORTS               NAMES
ec5fad3905b3        busybox             "sh"                2 weeks ago         Up 2 weeks                              macvlan20_2
4a790e26281b        busybox             "sh"                2 weeks ago         Up 13 days                              macvlan20_1
ec71a1c389dc        busybox             "sh"                2 weeks ago         Up 2 weeks                              macvlan10_2
77e6188d79ff        busybox             "sh"                2 weeks ago         Up 13 days                              macvlan10_1
```

We are going to attach container macvlan10\_1 to do some ICMP test

```bash
docker attach macvlan10_1
```

From bash shell inside of container macvlan10\_1, run `ifconfig -a` to list network interfaces and IPs

```bash
/ # ifconfig -a
eth0      Link encap:Ethernet  HWaddr 02:42:C0:A8:02:01  
          inet addr:192.168.2.1  Bcast:0.0.0.0  Mask:255.255.0.0
          inet6 addr: fe80::42:c0ff:fea8:201/64 Scope:Link
          UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1
          RX packets:381 errors:0 dropped:0 overruns:0 frame:0
          TX packets:2342 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:0 
          RX bytes:33358 (32.5 KiB)  TX bytes:212848 (207.8 KiB)

lo        Link encap:Local Loopback  
          inet addr:127.0.0.1  Mask:255.0.0.0
          inet6 addr: ::1/128 Scope:Host
          UP LOOPBACK RUNNING  MTU:65536  Metric:1
          RX packets:215 errors:0 dropped:0 overruns:0 frame:0
          TX packets:215 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1 
          RX bytes:24080 (23.5 KiB)  TX bytes:24080 (23.5 KiB)
```

**Note the HWaddr 02:42:C0:A8:02:01, it is a different MAC address than the attached interface eth1.10. This is becasuse in `Macvlan`, each container's interface will have its own MAC address.**

Run `route -n` to list routing information, the default gateway is 192.168.2.0

```bash
/ # route -n
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
0.0.0.0         192.168.2.0     0.0.0.0         UG    0      0        0 eth0
192.168.0.0     0.0.0.0         255.255.0.0     U     0      0        0 eth0
```

Notice ping container macvlan10\_2 (IP address 192.168.2.2) in same VM works, also ping container macvlan10\_4(IP address 192.169.3.2) in different VM also works, this is because those containers are in the same VLAN 10.

```bash
/ # ping 192.168.2.2
PING 192.168.2.2 (192.168.2.2): 56 data bytes
64 bytes from 192.168.2.2: seq=0 ttl=64 time=0.056 ms
64 bytes from 192.168.2.2: seq=1 ttl=64 time=0.063 ms
^C
--- 192.168.2.2 ping statistics ---
2 packets transmitted, 2 packets received, 0% packet loss
round-trip min/avg/max = 0.056/0.059/0.063 ms

/ # ping 192.168.3.2
PING 192.168.3.2 (192.168.3.2): 56 data bytes
64 bytes from 192.168.3.2: seq=0 ttl=64 time=0.440 ms
64 bytes from 192.168.3.2: seq=1 ttl=64 time=0.320 ms
^C
--- 192.168.3.2 ping statistics ---
2 packets transmitted, 2 packets received, 0% packet loss
round-trip min/avg/max = 0.320/0.364/0.440 ms
```

When ping 192.169.3.2, An ARP request is broadcasted to all hosts on same VLAN.

If we capture a network trace from node1's eth1 interface

```bash
tcpdump -i eth1 -n -e
```

We could see and ARP request sent from node0's eth1 to ask MAC address of 192.168.3.2, this packet is broadcasted to all interfaces in same VLAN, that's reason why node1's eth1 interface can receive it.

```bash
20:22:41.028839 02:42:c0:a8:02:01 > ff:ff:ff:ff:ff:ff, ethertype 802.1Q (0x8100), length 46: vlan 10, p 0, ethertype ARP, Request who-has 192.168.3.2 tell 192.168.2.1, length 28
20:22:41.028933 02:42:c0:a8:03:02 > 02:42:c0:a8:02:01, ethertype 802.1Q (0x8100), length 46: vlan 10, p 0, ethertype ARP, Reply 192.168.3.2 is-at 02:42:c0:a8:03:02, length 28
```

Node1 eth1 replied ARP request, after getting the MAC address of 192.168.3.2, the ICMP packet then send out and it get received from node1 eth1's interface eventually.

```bash
20:22:41.029129 02:42:c0:a8:02:01 > 02:42:c0:a8:03:02, ethertype 802.1Q (0x8100), length 102: vlan 10, p 0, ethertype IPv4, 192.168.2.1 > 192.168.3.2: ICMP echo request, id 2304, seq 0, length 64
20:22:41.029162 02:42:c0:a8:03:02 > 02:42:c0:a8:02:01, ethertype 802.1Q (0x8100), length 102: vlan 10, p 0, ethertype IPv4, 192.168.3.2 > 192.168.2.1: ICMP echo reply, id 2304, seq 0, length 64
```

The network trace is captured from eth1 so we can see it contains 802.1Q header and it has 'vlan 10' included. If we capture network trace on eth1.10, then 802.1Q header will be stripped out. Also, in above network trace, the MAC address being used is **02:42:c0:a8:02:01**, the MAC address of container macvlan10\_1.

Below network trace captured on node1's eth1.10 interface show there is no VLAN tag.

```bash
tcpdump -i eth1.10 -n -e "arp or icmp"
tcpdump: verbose output suppressed, use -v or -vv for full protocol decode
listening on eth1.10, link-type EN10MB (Ethernet), capture size 262144 bytes
09:36:43.482579 02:42:c0:a8:02:01 > 02:42:c0:a8:03:02, ethertype IPv4 (0x0800), length 98: 192.168.2.1 > 192.168.3.2: ICMP echo request, id 4352, seq 102, length 64
09:36:43.482616 02:42:c0:a8:03:02 > 02:42:c0:a8:02:01, ethertype IPv4 (0x0800), length 98: 192.168.3.2 > 192.168.2.1: ICMP echo reply, id 4352, seq 102, length 64
```

Let's try to ping VLAN 20's IP 192.169.2.1

```bash
/ # ping 192.169.2.1
PING 192.169.2.1 (192.169.2.1): 56 data bytes
^C
--- 192.169.2.1 ping statistics ---
11 packets transmitted, 0 packets received, 100% packet loss
```

You can see it's failed, this is because even VLAN 10 and VLAN 20 are attached to same physical network interface eth1 from node0, packets still won't be forwarded between different VLANs.

Later, we will discuss how to use master as a gateway to route traffics between different VLANs.

## 4 Route Traffics Between VLANs

Here is the solution to route traffics between different VLANs. We will use master as a gateway to route VLAN traffics

Enable IP forwarding on master

```bash
sysctl -w net.ipv4.ip_forward=1
```

Append below configurations to /etc/network/interfaces to create VLAN subinterfaces under eth1

```bash
vi /etc/network/interfaces
auto eth1
iface eth1 inet manual

auto eth1.10
iface eth1.10 inet manual
vlan-raw-device eth1

aut0 eth1.20
iface eth1.20 inet manual
vlan-raw-device eth1
```

Reboot master and bring up eth1.10 and eth1.20 subinterfaces

```bash
modprobe 8021q
ifup eth1.10
ifup eth1.20
```

Verfiy VLANs are created and up.

```bash
cat /proc/net/vlan/config
VLAN Dev name	 | VLAN ID
Name-Type: VLAN_NAME_TYPE_RAW_PLUS_VID_NO_PAD
eth1.10        | 10  | eth1
eth1.20        | 20  | eth1
```

Configure IP addresses on eth1.10 and eth1.20, those IP addresses will be gateway IP addresses for network 192.168.2.0/24, 192.169.2.0/24, 192.168.3.0/24 and 192.169.3.0/24.

```bash
ifconfig eth1.10 192.168.2.0 netmask 255.255.255.0 up
ifconfig eth1.20 192.169.2.0 netmask 255.255.255.0 up

ip address add 192.168.3.0/24 dev eth1.10
ip address add 192.169.3.0/24 dev eth1.20
```

The last step is to configure iptables, so that eth1.10(VLAN 10) and eth1.20(VLAN 20) can forward traffics to each other.

```bash
iptables -A FORWARD -i eth1.10 -o eth1.20 -j ACCEPT
iptables -A FORWARD -i eth1.20 -o eth1.10 -j ACCEPT
```

Let's ping 192.169.2.1 again, this time it works

```bash
/ # ping 192.169.2.1
PING 192.169.2.1 (192.169.2.1): 56 data bytes
64 bytes from 192.169.2.1: seq=0 ttl=63 time=0.710 ms
64 bytes from 192.169.2.1: seq=1 ttl=63 time=0.539 ms
64 bytes from 192.169.2.1: seq=2 ttl=63 time=0.546 ms
^C
--- 192.169.2.1 ping statistics ---
3 packets transmitted, 3 packets received, 0% packet loss
round-trip min/avg/max = 0.539/0.598/0.710 ms
```

Even ping 192.169.3.2, it still works

```bash
/ # ping 192.169.3.2
PING 192.169.3.2 (192.169.3.2): 56 data bytes
64 bytes from 192.169.3.2: seq=0 ttl=63 time=0.676 ms
64 bytes from 192.169.3.2: seq=1 ttl=63 time=0.525 ms
64 bytes from 192.169.3.2: seq=2 ttl=63 time=0.697 ms
^C
--- 192.169.3.2 ping statistics ---
3 packets transmitted, 3 packets received, 0% packet loss
round-trip min/avg/max = 0.525/0.632/0.697 ms
```

This is because master begins to forward traffics between differnt VLANs, if we capture network trace from master's eth1 interface, we can see traffics in below

```bash
21:10:20.668524 02:42:c0:a8:02:01 > 00:15:5d:10:31:14, ethertype 802.1Q (0x8100), length 102: vlan 10, p 0, ethertype IPv4, 192.168.2.1 > 192.169.3.2: ICMP echo request, id 3072, seq 0, length 64
21:10:20.668551 00:15:5d:10:31:14 > 02:42:c0:a9:03:02, ethertype 802.1Q (0x8100), length 102: vlan 20, p 0, ethertype IPv4, 192.168.2.1 > 192.169.3.2: ICMP echo request, id 3072, seq 0, length 64
21:10:20.668821 02:42:c0:a9:03:02 > 00:15:5d:10:31:14, ethertype 802.1Q (0x8100), length 102: vlan 20, p 0, ethertype IPv4, 192.169.3.2 > 192.168.2.1: ICMP echo reply, id 3072, seq 0, length 64
21:10:20.668840 00:15:5d:10:31:14 > 02:42:c0:a8:02:01, ethertype 802.1Q (0x8100), length 102: vlan 10, p 0, ethertype IPv4, 192.169.3.2 > 192.168.2.1: ICMP echo reply, id 3072, seq 0, length 64
```

## 5 Summary

`Macvlan` allows creation of multiple virtual network interfaces behind the host’s single physical interface Each virtual interface has unique MAC and IP addresses assigned with restriction: the IP address needs to be in the same broadcast domain as the physical interface eliminates the need for the Linux bridge, NAT and port- mapping allowing you to connect directly to physical interface.
