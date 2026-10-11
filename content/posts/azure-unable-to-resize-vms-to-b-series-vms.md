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
# Azure - Unable to Resize VM(s) to B-Series VM(s)

If VMs are deployed using the Resource Manager (ARM) deployment model and the new size requires different hardware, first stop and deallocate the VMs before resizing them.

In our case, we could not resize a running VM to a B-series VM. After stopping and deallocating it from the Azure portal, we were able to resize it.

Deallocation interrupts the workload and does not guarantee that the requested size has capacity in the region. Plan for downtime and check size availability first.

Refer to [Resize virtual machines](https://azure.microsoft.com/en-us/blog/resize-virtual-machines/)

Finally, to find out why a resize failed, run the following PowerShell script to display the errors. This historical example uses the AzureRM module; current scripts should use the corresponding Az cmdlets.

```powershell
$ResourceGroupName = "YOUR_RESOURCE_GROUP" 
$VMName = "YOUR_VM" 
$NewVMSize = "Standard_B2s"
$vm = Get-AzureRmVM -ResourceGroupName $ResourceGroupName -Name $VMName 
$vm.HardwareProfile.vmSize = $NewVMSize 
Update-AzureRmVM -ResourceGroupName $ResourceGroupName -VM $vm
```
