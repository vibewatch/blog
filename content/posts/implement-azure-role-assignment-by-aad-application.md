---
title: "Implement Azure Role Assignment by AAD Application with Powershell Script"
slug: "implement-azure-role-assignment-by-aad-application"
date: "2019-01-20 01:45:13"
updated: "2019-01-20 01:45:13"
type: "post"
status: "published"
visibility: "public"
featured: false
excerpt: "Implement Azure Role Assignment by AAD Application with Powershell Script"
feature_image: "/assets/posts/implement-azure-role-assignment-by-aad-application/hero.jpg"
authors: ["Yingting Huang"]
tags: ["AAD"]
---
The requirement come with ask "Having an application(first application) created in AAD and want to use first application to assign roles to a second application created in AAD"

To achieve that goal, Azure active directory admin needs to grant below permission for first application's service principal.  
![AAD-Perm](/assets/posts/implement-azure-role-assignment-by-aad-application/aad-perm.jpg)

Then below script can be used to assign roles to second application for corresponding resource

```powershell
# INPUT YOUR FIRST APPLICATION ID/SECRET
$creds = Get-Credential

$objId = <YOUR_SECOND_APPLICAITON_ID>
$tenantId = <YOUR_DIRECTORY_ID>
Connect-AzAccount -Credential $creds  -ServicePrincipal -Tenant $tenantId
$spId = (Get-AzADApplication -ObjectId $ojbId | Get-AzADServicePrincipal).Id

New-AzRoleAssignment -ObjectId $spId -RoleDefinitionName Reader -Scope <YOUR_RESOURCE>
```

Some comments for above script:

1.  New-AzRoleAssignment requires `ObjectId` as a parameter, however, in AAD, Application Id is not an object id, to get object id, need to run `$spId = (Get-AzADApplication -ObjectId $ojbId | Get-AzADServicePrincipal).Id` to convert application id to service principal's object id.
2.  `$spId = (Get-AzADApplication -ObjectId $ojbId | Get-AzADServicePrincipal).Id` will query AAD to map application id to object id, it requires AAD "Read Directory Data" permission, so need AAD admin to give permission to first application.
