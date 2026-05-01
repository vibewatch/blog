---
title: "Azure Custom Roles - Cook Guide"
slug: "azure-custom-role-cook-guide"
date: "2020-08-20 01:44:45"
updated: "2023-10-26 10:57:39"
type: "post"
status: "published"
visibility: "public"
featured: false
excerpt: ""
feature_image: "/assets/posts/azure-custom-role-cook-guide/hero.png"
authors: ["Yingting Huang"]
tags: ["Azure", "RBAC", "Custom Role"]
---
This article tries to provide a workflow so you can easily customize roles to suit your needs

[Azure role-based access control (Azure RBAC)](https://docs.microsoft.com/en-us/azure/role-based-access-control/overview) has several Azure built-in roles that you can assign to users, groups, service principals, and managed identities. RBAC ensures the proper segregation of administration between the different subscriptions, workloads and services. Role assignments are the way you control access to Azure resources. If the built-in roles don't meet the specific needs of your organization, you can create your own [Azure custom roles](https://docs.microsoft.com/en-us/azure/role-based-access-control/custom-roles).

When planning custom role mapping, this [toolkit](https://github.com/jkstant/AzureRACIToolkit) can be used as a reference for role mapping, it includes a set of reference worksheets and scripts to assist in the definition and creation of your own custom RBAC role(s).

The rest of this article will focus on how to define your own custom role, the role customization workflow will look like below

1.  Each azure resource has an "Export template" action, use it and you can understand where the settings are applied, use the resource type and match it in ARM provider operations in below.
2.  Leverage article [Azure resource provider operations,](https://learn.microsoft.com/en-us/azure/role-based-access-control/resource-provider-operations) this article provides completed list of all operations available from azure resource manager, these operations can be used in Azure custom roles to provide granular access control to resources in Azure.
3.  Or if you want to get all operations targets on a resource, you could run powershell command similar like `Get-AzProviderOperation "Microsoft.Web/*" | FT Operation, Description -AutoSize`, replace "Microsoft.Web" to any Azure resource you want to list operations.
4.  Clone existing role for customization, if certain operations are not allowed, add those operations to NotAction group, or remove them from Action group.
5.  Assign customized role to users/groups which you want to restrict access.

Take web role customization for example

1.  When you examine the resource of IP restriction rule (refer to screen shot below), you will see this setting is actually under "type": "Microsoft.Web/sites/config"

![](/assets/posts/azure-custom-role-cook-guide/custom-role-1.png)

2. If you search "Microsoft.Web/sites/config" from article [Azure resource provider operations](https://docs.microsoft.com/en-us/azure/role-based-access-control/resource-provider-operations), you will see it has below operations, so the best choice to prevent user from editing this setting is not giving them write and delete permission

<table><thead><tr><th></th><th></th><th></th></tr></thead><tbody><tr><td>Action</td><td>microsoft.web/sites/config/read</td><td>Get Web App configuration settings</td></tr><tr><td>Action</td><td>microsoft.web/sites/config/list/action</td><td>List Web App's security sensitive settings, such as publishing credentials, app settings and connection strings</td></tr><tr><td>Action</td><td>microsoft.web/sites/config/write</td><td>Update Web App's configuration settings</td></tr><tr><td>Action</td><td>microsoft.web/sites/config/delete</td><td>Delete Web Apps Config</td></tr></tbody></table>

3. Now we can start from clone a role and customize it, from subscription->Access control->Roles, find Website Contributor, right click it and choose Clone

![](/assets/posts/azure-custom-role-cook-guide/custom-role-2.png)

4. Follow the wizard and add below two operations to NotAction group

![](/assets/posts/azure-custom-role-cook-guide/custom-role-3.png)

5. From Assignable scopes, please make sure the scope is targeted to your subscription.

![](/assets/posts/azure-custom-role-cook-guide/custom-role-4.png)

6. Once the customized role is created, you can assign it to user/group which you want to restrict access.

If there is no any existing role, for example, if we want to achieve "Disable the WAF in Front Door", the methodology is still same here, the only difference is we need to create one, you could go to

1. Subscription-> Access control->Roles, Add custom role

![](/assets/posts/azure-custom-role-cook-guide/custom-role-5.png)

2. From Permissions, add below operations to Action group, make sure scope still targets to subscription and assign the customized role to user/group.

![](/assets/posts/azure-custom-role-cook-guide/custom-role-6.png)
