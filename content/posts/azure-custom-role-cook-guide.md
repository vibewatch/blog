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
# Azure Custom Roles - Cook Guide

This article provides a workflow to help you customize roles to suit your needs.

[Azure role-based access control (Azure RBAC)](https://docs.microsoft.com/en-us/azure/role-based-access-control/overview) has several Azure built-in roles that you can assign to users, groups, service principals, and managed identities. RBAC ensures the proper segregation of administration between the different subscriptions, workloads and services. Role assignments are the way you control access to Azure resources. If the built-in roles don't meet the specific needs of your organization, you can create your own [Azure custom roles](https://docs.microsoft.com/en-us/azure/role-based-access-control/custom-roles).

When planning custom role mapping, this [toolkit](https://github.com/jkstant/AzureRACIToolkit) can be used as a reference. It includes a set of reference worksheets and scripts to assist in defining and creating your own custom RBAC role(s).

The rest of this article focuses on how to define your own custom role. The role customization workflow looks like this:

1.  Each Azure resource has an "Export template" action. Use it to understand where the settings are applied, then use the resource type and match it against the ARM provider operations below.
2.  Use the article [Azure resource provider operations](https://learn.microsoft.com/en-us/azure/role-based-access-control/resource-provider-operations), which provides a complete list of all operations available from Azure Resource Manager. These operations can be used in Azure custom roles to provide granular access control to Azure resources.
3.  If you want to get all operations that target a resource, you can run a PowerShell command similar to `Get-AzProviderOperation "Microsoft.Web/*" | FT Operation, Description -AutoSize`. Replace "Microsoft.Web" with the Azure resource provider whose operations you want to list.
4.  Clone an existing role for customization. If certain operations should not be allowed, add those operations to `NotActions` or remove them from `Actions`.
5.  Assign the customized role to users/groups whose access you want to restrict.

`NotActions` subtracts permissions from this role; it is not a deny rule. Another role assignment can still grant those permissions, so review the user's effective access across all assignments.

Take web role customization as an example:

1.  When you examine the IP restriction rule resource (see the screenshot below), you will see that this setting is under `"type": "Microsoft.Web/sites/config"`.

![Azure portal export template view showing the IP restriction configuration resource type under Microsoft.Web/sites/config](/assets/posts/azure-custom-role-cook-guide/custom-role-1.png)

2. If you search for "Microsoft.Web/sites/config" in [Azure resource provider operations](https://docs.microsoft.com/en-us/azure/role-based-access-control/resource-provider-operations), you will find the operations below. To prevent users from editing this configuration through this role, exclude the write and delete permissions.

<table><thead><tr><th></th><th></th><th></th></tr></thead><tbody><tr><td>Action</td><td>microsoft.web/sites/config/read</td><td>Get Web App configuration settings</td></tr><tr><td>Action</td><td>microsoft.web/sites/config/list/action</td><td>List Web App's security sensitive settings, such as publishing credentials, app settings and connection strings</td></tr><tr><td>Action</td><td>microsoft.web/sites/config/write</td><td>Update Web App's configuration settings</td></tr><tr><td>Action</td><td>microsoft.web/sites/config/delete</td><td>Delete Web Apps Config</td></tr></tbody></table>

3. Now we can clone and customize a role. From Subscription -> Access control -> Roles, find Website Contributor, right-click it, and choose Clone.

![Azure portal Access control Roles page with Website Contributor selected for cloning](/assets/posts/azure-custom-role-cook-guide/custom-role-2.png)

4. Follow the wizard and add the two operations shown below to `NotActions`.

![Azure custom role wizard showing Microsoft.Web sites config write and delete operations added to NotActions](/assets/posts/azure-custom-role-cook-guide/custom-role-3.png)

5. From Assignable scopes, please make sure the scope is targeted to your subscription.

![Azure custom role wizard Assignable scopes step targeting the subscription scope](/assets/posts/azure-custom-role-cook-guide/custom-role-4.png)

6. Once the customized role is created, assign it to the users or groups whose access you want to limit.

If no existing role fits—for example, if we want to allow a user to disable the WAF in Front Door—the methodology is the same, except that we create a role from scratch:

1. Subscription-> Access control->Roles, Add custom role

![Azure portal Roles page showing the Add custom role action](/assets/posts/azure-custom-role-cook-guide/custom-role-5.png)

2. From Permissions, add the operations shown below to `Actions`, make sure the scope still targets the subscription, and assign the customized role to the user or group.

![Azure custom role wizard Permissions step showing operations added to the Actions group](/assets/posts/azure-custom-role-cook-guide/custom-role-6.png)
