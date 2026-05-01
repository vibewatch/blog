---
title: "Configure Ubuntu to Support Multiple NICs in Azure"
slug: "configure-ubuntu-to-support-multiple-nics-in-azure"
date: "2018-05-22 12:50:29"
updated: "2018-05-24 14:26:53"
type: "post"
status: "published"
visibility: "public"
featured: false
excerpt: ""
feature_image: "/assets/posts/configure-ubuntu-to-support-multiple-nics-in-azure/hero.jpg"
authors: ["Yingting Huang"]
tags: ["Azure", "Linux", "Network", "Ubuntu"]
---
By default, in Linux, if multiple NICs are in same subnet, all traffics will route through the default NIC that usually will be eth0, if multiple NICs are added, to route traffics back to the NIC that receives it, we need to create route table for that NIC, refer to [How to create a Linux virtual machine in Azure with multiple network interface cards](https://docs.microsoft.com/en-us/azure/virtual-machines/linux/multiple-nics)

However, for Ubuntu newest OS, it doesn't use /etc/sysconfig/network-scripts any more, here are the steps for Ubuntu

```bash
sudo -i
bash -c "echo '200 eth1-rt' >> /etc/iproute2/rt_tables"
vi /etc/network/interfaces.d/eth1.cfg
# Configure second NIC and populate new routing table 
auto eth1
iface eth1 inet dhcp
    post-up ip route add 10.0.1.0/24 dev eth1 src 10.0.1.5 table eth1-rt
    post-up ip route add default via 10.0.1.1 dev eth1 table eth1-rt
    post-up ip rule add from 10.0.1.5/32 table eth1-rt
    post-up ip rule add to 10.0.1.5/32 table eth1-rt
```
