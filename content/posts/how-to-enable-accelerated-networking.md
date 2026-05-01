---
title: "How to Enable Accelerated Networking for Existing Linux VM"
slug: "how-to-enable-accelerated-networking"
date: "2018-05-20 13:51:00"
updated: "2018-05-24 14:28:33"
type: "post"
status: "published"
visibility: "public"
featured: false
excerpt: "How to enable accelerated networking for existing Linux VM"
feature_image: "/assets/posts/how-to-enable-accelerated-networking/hero.jpg"
authors: ["Yingting Huang"]
tags: ["Azure", "Linux", "Acceleratd Networking", "CLI"]
---
Unfortunately, Azure only supports accelerated networking for newly created Linux VM, refer to [Create a Linux virtual machine with Accelerated Networking](https://docs.microsoft.com/en-us/azure/virtual-network/create-vm-accelerated-networking-cli)

> Accelerated networking can only be enabled for a new NIC. It cannot be enabled for an existing NIC.

Here is the workaround to enable accelerated networking for existing Linux VM.

1.  You need to login to this VM and run

```bash
sudo waagent -deprovision+user
```

2.  After that, from Azure CLI command prompt, run

```bash
az vm deallocate --resource-group myResourceGroup --name myVM

az vm generalize --resource-group myResourceGroup --name myVM

az image create --resource-group myResourceGroup --name myImage --source myVM
```

3.  Now we can use the image to reate a new VM with accelerated networking

```bash
az network vnet create --resource-group myResourceGroup --name myVnet --address-prefix 192.168.0.0/16 --subnet-name mySubnet --subnet-prefix 192.168.1.0/24

az network nsg create --resource-group myResourceGroup --name myNetworkSecurityGroup

az network nsg rule create --resource-group myResourceGroup --nsg-name myNetworkSecurityGroup --name Allow-SSH-Internet --access Allow --protocol Tcp --direction Inbound --priority 100 --source-address-prefix Internet --source-port-range "" --destination-address-prefix "" --destination-port-range 22

az network public-ip create --name myPublicIp --resource-group myResourceGroup

az network nic create --resource-group myResourceGroup --name myNic --vnet-name myVnet --subnet mySubnet --accelerated-networking true --public-ip-address myPublicIp --network-security-group myNetworkSecurityGroup

az vm create --resource-group myResourceGroup --name myNewVM --image myImage --size Standard_DS4_v2 --admin-username azureuser --generate-ssh-keys --nics myNic 
```
