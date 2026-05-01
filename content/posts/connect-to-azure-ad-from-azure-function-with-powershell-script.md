---
title: "Connect to Azure AD from Azure Functions with Powershell Script"
slug: "connect-to-azure-ad-from-azure-function-with-powershell-script"
date: "2018-05-30 10:15:51"
updated: "2018-05-30 10:26:52"
type: "post"
status: "published"
visibility: "public"
featured: false
excerpt: ""
feature_image: "/assets/posts/connect-to-azure-ad-from-azure-function-with-powershell-script/hero.png"
authors: ["Yingting Huang"]
tags: ["Azure Function", "Azure", "Function App", "Powershell", "AzureAD", "AAD"]
---
There are certain things to overcome to use Connect-AzureAD from powershell script under azure functions by authenticating with certificate. This article explains how to do it.

## 0 Prerequisites

Azure functions has been deployed already.

## 1 Generate Certificate and Service Principal

To run Azure AD powershell commands, we need to connect to Azure AD first. Connect-AzureAD currently supports three methods to connect to Azure AD, refer to [Connect-AzureAD](https://docs.microsoft.com/en-us/powershell/module/azuread/connect-azuread?view=azureadps-2.0)

*   By credential
*   By CertificateThumbprint & ApplicationId
*   By AadAccessToken & AccountId

Since we don't want to store cleartext credentials in our azure functions app, the best choice here is to use certificate.

To generate a self-signed certificate and associate it with an AAD applicaiton service principal, we can follow below steps.  
**NOTE:** Please replace `YOUR_PASSWORD`, `YOUR_PFX_PATH` and `YOUR_APP_NAME` with corresponding values.

```powershell
# Login to Azure AD PowerShell With Admin Account
Connect-AzureAD

# Create the self signed cert
$currentDate = Get-Date
$endDate  = $currentDate.AddYears(1)
$notAfter  = $endDate.AddYears(1)
$pwd  = "YOUR_PASSWORD"
$thumb = (New-SelfSignedCertificate -CertStoreLocation cert:\localmachine\my -DnsName YOUR_DNS -KeyExportPolicy Exportable -Provider "Microsoft Enhanced RSA and AES Cryptographic Provider" -NotAfter $notAfter).Thumbprint
$pwd = ConvertTo-SecureString -String $pwd -Force -AsPlainText
Export-PfxCertificate -cert "cert:\localmachine\my\$thumb" -FilePath YOUR_PFX_PATH.pfx -Password $pwd

# Load the certificate
$cert  = New-Object System.Security.Cryptography.X509Certificates.X509Certificate("YOUR_PFX_PATH.pfx", $pwd)
$keyValue = [System.Convert]::ToBase64String($cert.GetRawCertData())

# Create the Azure Active Directory Application
$application = New-AzureADApplication -DisplayName "YOUR_APP_NAME" -IdentifierUris "https://YOUR_APP_NAME"
New-AzureADApplicationKeyCredential -ObjectId $application.ObjectId -CustomKeyIdentifier "YOUR_PASSWORD" -StartDate $currentDate -EndDate $endDate -Type AsymmetricX509Cert -Usage Verify -Value $keyValue

# Create the Service Principal and connect it to the Application
$sp = New-AzureADServicePrincipal -AppId $application.AppId

# Give the Service Principal Reader access to the current tenant (Get-AzureADDirectoryRole)
Add-AzureADDirectoryRoleMember -ObjectId 72f988bf-86f1-41af-91ab-2d7cd011db47 -RefObjectId $sp.ObjectId

# Get Tenant Detail
$tenant = Get-AzureADTenantDetail

# Now you can login to Azure PowerShell with your Service Principal and Certificate
Connect-AzureAD -TenantId $tenant.ObjectId -ApplicationId  $sp.AppId -CertificateThumbprint $thumb

# Output TenantId, AppId and Thumbprint to use in azure function's script
Write-Host "TenantId: "$tenant.ObjectId
Write-Host "AppId: "$sp.AppId
Write-Host "Thumbprint: "$thumb
```

## 2 Configure Azure Function to Use Certificate

To use the generated certificate to connect to Azure AD, we need to make the certificate avaiable to Azure functions, from Azure portal

*   YOUR\_AZURE\_FUNCTION->Platform features->SSL, click 'Upload Certificate' to upload the exported .pfx format certificate in **Step 1**  
    ![add-ssl](/assets/posts/connect-to-azure-ad-from-azure-function-with-powershell-script/add-ssl.jpg)
*   YOUR\_AZURE\_FUNCTION->Platform features->Application settings->Add new settings, add a new setting with name called 'WEBSITE\_LOAD\_CERTIFICATE' and set its value to thumbprint of generated certificate.  
    ![app-settings](/assets/posts/connect-to-azure-ad-from-azure-function-with-powershell-script/app-settings.jpg)
*   YOUR\_AZURE\_FUNCTION->Platform features->Application settings->Platform, change to 64-bit.  
    ![platform-setting](/assets/posts/connect-to-azure-ad-from-azure-function-with-powershell-script/platform-setting.jpg)
*   YOUR\_AZURE\_FUNCTION->Platform features->Deployment credentials, set a credential to be used later with FTP deployment.  
    ![credential-setting](/assets/posts/connect-to-azure-ad-from-azure-function-with-powershell-script/credential-setting.jpg)

## 3 Copy AzureAD PowerShell Module to Azure Function

Azure functions hosting environment doesn't provide AzureAD powershell module by default, to use AzureAD powershell module, we need to 'INJECT' it into the Azure functions host environment. Basically we need a central place to store AzureAD powershell module and load it from this central place. We will use wwwroot\\YOUR\_FUNCTION\_NAME as the central place.

*   First, let's store a copy of AzureAD module from local powershell environment, from a Windows machine, run

```powershell
Save-Module AzureAD -Repository PSGallery -Path C:\Temp
```

*   A folder named AzureAD will be created under C:\\Temp and all AzureAD related files will be downloaded into this folder.
*   Now copy AzureAD module to Azure function hosting environment, from YOUR\_AZURE\_FUNCTION->Platform features-Properties, find ftp URL of 'FTP Host Name'  
    ![ftp-settings](/assets/posts/connect-to-azure-ad-from-azure-function-with-powershell-script/ftp-settings.jpg)
*   from Windows Explorer, access 'FTP Host Name' URL with deployment credential configured preivously in **Step 2**
*   Navigate to site/wwwroot/YOUR\_FUNCTION\_NAME then copy AzureAD into it  
    ![ftp-folder](/assets/posts/connect-to-azure-ad-from-azure-function-with-powershell-script/ftp-folder.jpg)

## 4 Write PowerShell Script from Azure Function to Connect to Azure AD

With the configurations & setups from Step 1, Step 2 and Step 3, we are good to run AzureAD powershell scripts from Azure function now. Here are the steps to create powershell azure functions and call Connect-AzureAD,

From Azure portal, create an Azure powershell function  
![powershell-fun](/assets/posts/connect-to-azure-ad-from-azure-function-with-powershell-script/powershell-fun.jpg)  
Then copy/paste below code snippet into it

```powershell
Write-Output "PowerShell function executing at:$(get-date)";
 
$FunctionName = 'YOUR_FUNCTION_NAME'
$ModuleName = 'AzureAD'
# Replace module version with 
$ModuleVersion = '2.0.1.10'
# Your Aad Tenant Id
$TenantId = 'YOUR_TENANT_ID'
# Your Application Service Principal Id
$AppId = 'YOUR_APP_ID'
# Your Certificate Thumbprint
$Thumbprint = 'YOUR_THUMBPRINT'
# Import AzureAD PS module
$PSModulePath = "D:\home\site\wwwroot\$FunctionName\$ModuleName\$ModuleVersion\$ModuleName.psd1"
Import-module $PSModulePath

# Connect to AAD
Connect-AzureAD -TenantId $TenantId -ApplicationId $AppId -CertificateThumbprint $Thumbprint
Write-Output "PowerShell function executed at:$(get-date)";
```

**Note:**

*   YOUR\_FUNCTION\_NAME needs to be replaced with real azure function name.
*   YOUR\_TENANT\_ID, YOUR\_APP\_ID and YOUR\_THUMBPRINT needs to be replaced as well, those information can be found from Step 1's output.
*   Depends on the exported AzureAD module version, $ModuleVersion need to be changed. To check AzureAD module, check the subfolder under AzureAD folder, the subfolder's name is the module version.

The powershell Azure function should be ready now, click 'Run' button, the output should be like below

```bash
2018-05-30T10:03:59  Welcome, you are now connected to log-streaming service.
2018-05-30T10:04:22.488 [Info] Function started (Id=386cd8a7-4e0b-4120-a669-353b28527ab3)
2018-05-30T10:04:22.581 [Info] PowerShell function executing at:05/30/2018 10:04:22
2018-05-30T10:04:23.675 [Info] Microsoft.Open.Azure.AD.CommonLibrary.PSAzureContext
2018-05-30T10:04:23.675 [Info] PowerShell function executed at:05/30/2018 10:04:23
2018-05-30T10:04:23.675 [Info] Function completed (Success, Id=386cd8a7-4e0b-4120-a669-353b28527ab3, Duration=1185ms)
```
