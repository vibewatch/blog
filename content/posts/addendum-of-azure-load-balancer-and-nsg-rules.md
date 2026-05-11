---
title: "Addendum of Azure Load Balancer and NSG Rules"
slug: "addendum-of-azure-load-balancer-and-nsg-rules"
date: "2018-05-28 03:29:59"
updated: "2018-05-29 02:46:18"
type: "post"
status: "published"
visibility: "public"
featured: false
excerpt: ""
feature_image: "/assets/posts/addendum-of-azure-load-balancer-and-nsg-rules/hero.png"
authors: ["Yingting Huang"]
tags: ["Load Balancer", "Azure"]
---
## 1 AllowAzureLoadBalancerInBound NSG Rule

When an IaaS VM gets deployed in Azure, a default NSG rule named AllowAzureLoadBalancerInBound is created.
![Allow Azure Load Balancer inbound NSG rule](/assets/posts/addendum-of-azure-load-balancer-and-nsg-rules/allow-azure-load-balancer-inbound.jpg)

You might wonder what this NSG rule means. Basically, this rule allows the "Azure Load Balancer Health Probe". When an Azure Load Balancer is created, it probes the backend to detect whether the backend service is healthy. The probe packet is sent from the source address "AzureLoadBalancer", and the IP address of "AzureLoadBalancer" is always **168.63.129.16**.

Refer to [Network security](https://docs.microsoft.com/en-us/azure/virtual-network/security-overview#azure-platform-considerations)

> Virtual IP of the host node: Basic infrastructure services such as DHCP, DNS, and health monitoring are provided through the virtualized host IP addresses 168.63.129.16 and 169.254.169.254. These public IP addresses belong to Microsoft and are the only virtualized IP addresses used in all regions for this purpose. The addresses map to the physical IP address of the server machine (host node) hosting the virtual machine. The host node acts as the DHCP relay, the DNS recursive resolver, **and the probe source for the load balancer health probe and the machine health probe**.

## 2 How to set up an NSG rule to allow load-balanced traffic

If we are going to allow load-balanced inbound traffic, the NSG rule should always use the **"backend port"** as the destination port. For example, if we create a load-balancing rule to open port 80 from the load balancer public IP address while using 8080 as the backend port, then the corresponding NSG rule should allow port 8080 as the destination port, not port 80.
