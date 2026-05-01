---
title: "Azure - Unable to Resize VM(s) to B-Series VM(s)"
slug: "azure-unable-to-resize-vms-to-b-series-vms"
date: "2018-05-22 12:32:21"
updated: "2018-05-24 14:20:58"
type: "post"
status: "published"
visibility: "public"
featured: false
excerpt: ""
feature_image: "/assets/posts/azure-unable-to-resize-vms-to-b-series-vms/hero.jpg"
authors: ["Yingting Huang"]
tags: ["Azure", "Powershell", "VM"]
---
If the VM(s) are deployed using the Resource Manager (ARM) deployment model and we need to change to a size which requires different hardware then we can resize VMs by first stopping the VM.

In our case, we are not able to resize a live VM to B-series VM, we stopped(deallocated) VM from azure portal, then afterwords, we are able to resize it now.

Refer to [Resize virtual machines](https://azure.microsoft.com/en-us/blog/resize-virtual-machines/)

Finally, if need to get details about why could not resize VM, run below powershell script to print out errors

```powershell
$ResourceGroupName = "YOUR_RESOURCE_GROUP" 
$VMName = "YOUR_VM" 
$NewVMSize = "Standard_B2s"
$vm = Get-AzureRmVM -ResourceGroupName $ResourceGroupName -Name $VMName 
$vm.HardwareProfile.vmSize = $NewVMSize 
Update-AzureRmVM -ResourceGroupName $ResourceGroupName -VM $vm
```
