---
title: "Deploy a Ubuntu Based Flannel K8S Cluster in Azure with ARM Template and Kubeadm"
slug: "deploy-a-ubuntu-based-flannel-k8s-cluster-in-azure-with-arm-template-and-kubeadm"
date: "2018-05-23 11:34:53"
updated: "2018-05-24 14:23:22"
type: "post"
status: "published"
visibility: "public"
featured: true
excerpt: ""
feature_image: "/assets/posts/deploy-a-ubuntu-based-flannel-k8s-cluster-in-azure-with-arm-template-and-kubeadm/hero.jpg"
authors: ["Yingting Huang"]
tags: ["Azure", "Linux", "Network", "Ubuntu", "K8S", "Kubernetes"]
---
The infomation migth be outdated here as acs-engine adds support for Flannel recently with PR [2967](https://github.com/Azure/acs-engine/pull/2967)

However, if you want to gain more control on your kubernetes cluster in Azure, in our case, by using kubeadm, this article still applies.

## 0\. Prerequisites

*   Azure subscription
*   An Azure account has sufficient permission to create a service principal

## 1\. Create a service principal which will be used to manage azure resources in K8S cluster

Follow [Install Azure CLI 2.0](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli?view=azure-cli-latest) install Azure CLI. From command prompt/shell, login and create a service principal by issueing below commands, replace YOUR\_SUBSCRIPTION\_ID with your Azure subscription ID.

```bash
az login
az account set --subscription "YOUR_SUBSCIPTION_ID"
az ad sp create-for-rbac --role="Contributor" --scopes="/subscriptions/YOUR_SUBSCRIPTION_ID"
```

Once the service principal get created, the result looks like below

```json
{
  "appId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "displayName": "azure-cli-2018-04-26-07-03-35",
  "name": "http://azure-cli-2018-04-26-07-03-35",
  "password": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
  "tenant": "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz"
}
```

Record appId and password, they will be used as configured parameters in ARM template.

## 2\. Customize your K8s deployment script

[Azure Custom Script Extension](https://docs.microsoft.com/en-us/azure/virtual-machines/extensions/custom-script-linux) will be ussed to install docker and kubeadm from ARM template. To do that, create a file called script.sh, paste below content into it

```bash
#!/bin/sh
apt-get update
apt-get install -y docker.io
apt-get update && apt-get install -y apt-transport-https curl
curl -s https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key add -
cat <<EOF >/etc/apt/sources.list.d/kubernetes.list
deb http://apt.kubernetes.io/ kubernetes-xenial main
EOF
apt-get update
apt-get install -y kubelet kubeadm kubectl
cat <<EOF >/etc/kubernetes/kubeadm.conf
piVersion: kubeadm.k8s.io/v1alpha1
kind: MasterConfiguration
cloudProvider: azure
kubernetesVersion: 1.10.2
apiServerExtraArgs:
  cloud-provider: azure
  cloud-config: /etc/kubernetes/cloud-config
controllerManagerExtraArgs:
  cloud-provider: azure
  cloud-config: /etc/kubernetes/cloud-config
networking:
  podSubnet: 10.244.0.0/16
EOF
sed -i -E 's/(.*)KUBELET_KUBECONFIG_ARGS=(.*)$/\1KUBELET_KUBECONFIG_ARGS=--cloud-provider=azure --cloud-config=\/etc\/kubernetes\/cloud-config \2/' /etc/systemd/system/kubelet.service.d/10-kubeadm.conf
echo "net.bridge.bridge-nf-call-iptables = 1" >> /etc/sysctl.conf
echo "net.bridge.bridge-nf-call-ip6tables = 1" >> /etc/sysctl.conf
/sbin/sysctl -p /etc/sysctl.conf
```

[Azure Custom Script Extension](https://docs.microsoft.com/en-us/azure/virtual-machines/extensions/custom-script-linux) requies a base64 encoded script to execute

> The script **must** be base64 encoded. The script can **optionally** be gzip'ed.

Here is the command to generate a base64 encoded script with gzip enabled

```bash
cat script.sh | gzip -9 | base64 -w 0
```

The result will be below, copy/paste it to the ARM template in Step 3

```bash
H4sIAOcA8FoCA61UXW/UMBB8z69YCmoByfalqioU9U4q1bVCUIo44OmkyrHdnBVfbNnOtYf48Wzc3GdB9IGXrDy7npn1rvLyBSt1w8Is4y6SSkVoneRRrY+6CZEbA2QJ0opaeartXi0cHsIfyjsoet4EZ30ksxhdANF6k3UfIAESVDDmuKh5pQIVxraSVtZWRlFh5wwpGKp2kdRqSStXwS/oT8ClBJIJHuHsbHxzCSOmYqplwbZeIKHRIVLJ6rZUvlGxRzKpyiSO2lhNt9LaMtgcyYNqNDcw57rJUOEZb9RdNgh1kct5iiKaJy43IqwvxYabu8zpH8oHbZtiRUHrd8nXIufGzXie1bqRBVzzEJW/wDu6aj2PeCVL7/fF24WWyhfAf7ZeZRulNXNO8wE9Rvt6ovxC+fEDzuncV6HIABIJcXssK1wkwQL2m9jOZhiit8Yof80bnOx/F0Do3np8iKojdFZO2hIx7Az7OjmhAzpg+WkaWVC4JBrIGI4Ce03fvvn4/f340/jbbRcvbj5ffri6Pf96NRl2uVdsmv8tT8iu8WHyDSv40dlw2vmebhmf7jiH6TE7euwtLHGAc9lH1i8ODTgRLRRubT4gO6uhxMzCAZLS0mtZqT6Q5o4I3D6iXeSlUQGGkB/AaLSWwf17LsPpvyhYSL+LhABxTwuy32x+HQVSBAAA
```

## 3\. ARM template

Create a file called template.json, paste below content into it

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "numberOfInstances": {
      "type": "int",
      "defaultValue": 2,
      "metadata": {
        "description": "Number of VM instances to create, default is 2"
      }
    },
    "adminUsername": {
      "type": "string",
      "defaultValue": "Admin username>",
      "metadata": {
        "description": "Admin username for the Virtual Machines"
      }
    },
    "sshKeyData": {
      "type": "string",
      "defaultValue": "SSH public key>",
      "metadata": {
        "description": "SSH public key for the Virtual Machines"
      }
    },
    "imagePublisher": {
      "type": "string",
      "defaultValue": "Canonical",
      "metadata": {
        "description": " Publisher for the OS image, the default is Canonical"
      }
    },
    "imageOffer": {
      "type": "string",
      "defaultValue": "UbuntuServer",
      "metadata": {
        "description": "The name of the image offer. The default is Ubuntu"
      }
    },
    "imageSKU": {
      "type": "string",
      "defaultValue": "16.04-LTS",
      "metadata": {
        "description": "Version of the image. The default is 16.04-LTS"
      }
    },
    "vmSize": {
      "type": "string",
      "defaultValue": "Standard_F2s",
      "metadata": {
        "description": "VM size"
      }
    },
    "aadClientId": {
      "type": "string",
      "metadata": {
        "description": "AAD client Id"
      }
    },
    "aadClientSecret": {
      "type": "string",
      "metadata": {
        "description": "AAD client secret"
      }
    }      
  },
  "variables": {
    "apiVersionCompute": "2016-03-30",
    "apiVersionStorage": "2017-10-01",
    "apiVersionNetwork": "2018-02-01",
    "apiVersionAvailabilitySet": "2017-12-01",
    "vmName": "[concat('k8snode-', uniqueString(resourceGroup().id))]",    
    "storageAccountName": "[concat('k8sstorage', uniqueString(resourceGroup().id))]",    
    "vnetName": "[concat('k8svnet-', uniqueString(resourceGroup().id))]",
    "vnetID": "[resourceId('Microsoft.Network/virtualNetworks',variables('vnetName'))]",
    "subnetName": "k8ssubnet",        
    "subnetRef": "[concat(variables('vnetID'),'/subnets/',variables('subnetName'))]",
    "availabilitySetName": "[concat('k8savset-', uniqueString(resourceGroup().id))]",
    "publicIPAddressName": "[concat('k8spublicip-', uniqueString(resourceGroup().id))]",
    "publicIPAddressType": "Static",
    "networkSecurityGroupName": "[concat('k8snsg-', uniqueString(resourceGroup().id))]",
    "routeTableName": "[concat('k8sroutetable-', uniqueString(resourceGroup().id))]",
    "routeTableID": "[resourceId('Microsoft.Network/routeTables', variables('routeTableName'))]",
    "sshKeyPath": "[concat('/home/',parameters('adminUsername'),'/.ssh/authorized_keys')]",    
    "addressPrefix": "172.16.0.0/16",
    "subnetPrefix": "172.16.0.0/24",
    "nicName": "[concat('k8snicname-', uniqueString(resourceGroup().id))]",
    "cseName" : "[concat('k8scse-', uniqueString(resourceGroup().id))]"
  },
  "resources": [
    {
      "apiVersion": "[variables('apiVersionStorage')]", 
      "type": "Microsoft.Storage/storageAccounts",
      "name": "[variables('storageAccountName')]",
      "location": "[resourceGroup().location]",
      "sku": {
          "name": "Standard_LRS"
      },
      "kind": "Storage",
      "properties": {}
    },
    {
      "apiVersion": "[variables('apiVersionNetwork')]", 
      "type": "Microsoft.Network/networkSecurityGroups",
      "name": "[variables('networkSecurityGroupName')]",
      "location": "[resourceGroup().location]",
      "properties": {
        "securityRules": [
          {
            "name": "SSH",
            "properties": {
              "description": "Allow inbound SSH port.",
              "protocol": "Tcp",
              "sourcePortRange": "*",
              "destinationPortRange": "22",
              "sourceAddressPrefix": "*",
              "destinationAddressPrefix": "*",
              "access": "Allow",
              "priority": 200,
              "direction": "Inbound"
            }
          },
          {
            "name": "allow_kube_tls",
            "properties": {
              "description": "Allow inbound SSH port.",
              "protocol": "Tcp",
              "sourcePortRange": "*",
              "destinationPortRange": "6443",
              "sourceAddressPrefix": "*",
              "destinationAddressPrefix": "*",
              "access": "Allow",
              "priority": 300,
              "direction": "Inbound"
            }
          }          
        ]
      }
    },
    {
      "apiVersion": "[variables('apiVersionNetwork')]",
      "type": "Microsoft.Network/publicIPAddresses",
      "sku": {
        "name": "Basic",
        "tier": "Regional"
      },      
      "name": "[concat(variables('publicIPAddressName'), '-', copyIndex())]",
      "location": "[resourceGroup().location]",
      "copy": {
        "name": "publicIPLoop",
        "count": "[parameters('numberOfInstances')]"
      },
      "properties": {
        "publicIPAllocationMethod": "[variables('publicIPAddressType')]",
        "dnsSettings": {
          "domainNameLabel": "[concat(variables('vmName'), '-', copyIndex())]"
        }
      }
    },
    {
      "apiVersion": "[variables('apiVersionNetwork')]",
      "type": "Microsoft.Network/virtualNetworks",
      "name": "[variables('vnetName')]",
      "location": "[resourceGroup().location]",
      "dependsOn": [
        "[concat('Microsoft.Network/routeTables/', variables('routeTableName'))]",        
        "[concat('Microsoft.Network/networkSecurityGroups/', variables('networkSecurityGroupName'))]"
      ],      
      "properties": {
        "addressSpace": {
          "addressPrefixes": [
            "[variables('addressPrefix')]"
          ]
        },
        "subnets": [
          {
            "name": "[variables('subnetName')]",
            "properties": {
              "addressPrefix": "[variables('subnetPrefix')]",
              "networkSecurityGroup": {
                "id": "[resourceId('Microsoft.Network/networkSecurityGroups', variables('networkSecurityGroupName'))]"
              },
              "routeTable": {
                "id": "[variables('routeTableID')]"
              }
            }
          }
        ]
      }
    },
    {
      "apiVersion": "[variables('apiVersionNetwork')]",
      "type": "Microsoft.Network/routeTables",      
      "location": "[resourceGroup().location]",
      "name": "[variables('routeTableName')]"
    },
    {
      "apiVersion": "[variables('apiVersionNetwork')]",
      "type": "Microsoft.Network/networkInterfaces",
      "name": "[concat(variables('nicName'), '-', copyIndex())]",
      "location": "[resourceGroup().location]",
      "copy": {
        "name": "nicLoop",
        "count": "[parameters('numberOfInstances')]"
      },
      "dependsOn": [
        "[concat('Microsoft.Network/publicIPAddresses/', variables('publicIPAddressName'), '-', copyIndex())]",
        "[concat('Microsoft.Network/virtualNetworks/', variables('vnetName'))]"
      ],
      "properties": {
        "ipConfigurations": [
          {
            "name": "ipconfig1",
            "properties": {
              "privateIPAllocationMethod": "Dynamic",
              "publicIPAddress": {
                "id": "[resourceId('Microsoft.Network/publicIPAddresses', concat(variables('publicIPAddressName'), '-', copyIndex()))]"
              },
              "subnet": {
                "id": "[variables('subnetRef')]"
              }
            }
          }
        ]
      }
    },
    {
      "apiVersion": "[variables('apiVersionAvailabilitySet')]",
      "type": "Microsoft.Compute/availabilitySets",
      "sku": {
        "name": "Classic"
      },      
      "name": "[variables('availabilitySetName')]",
      "location": "[resourceGroup().location]",
      "properties": {
        "platformFaultDomainCount": 3,
        "platformUpdateDomainCount": 5
      }
    },    
    {
      "apiVersion": "[variables('apiVersionCompute')]",    
      "type": "Microsoft.Compute/virtualMachines/extensions",
      "name": "[concat(variables('vmName'), '-', copyIndex(), '/', variables('cseName'))]",
      "location": "[resourceGroup().location]",
      "copy": {
        "name": "cseLoop",
        "count": "[parameters('numberOfInstances')]"
      },      
      "dependsOn": [
        "[concat('Microsoft.Compute/virtualMachines/', variables('vmName'), '-', copyIndex())]"
      ],
      "properties": {
        "publisher": "Microsoft.Azure.Extensions",
        "type": "CustomScript",
        "typeHandlerVersion": "2.0",
        "autoUpgradeMinorVersion": false,
        "settings": {
          "script": "<Replace it with base64 output from step 2>"
        }
      }
    },
    {
      "apiVersion": "[variables('apiVersionCompute')]",
      "type": "Microsoft.Compute/virtualMachines",
      "name": "[concat(variables('vmName'), '-', copyIndex())]",
      "location": "[resourceGroup().location]",
      "copy": {
        "name": "vmLoop",
        "count": "[parameters('numberOfInstances')]"
      },
      "dependsOn": [
        "[concat('Microsoft.Network/networkInterfaces/', variables('nicName'), '-', copyIndex())]",
        "[concat('Microsoft.Compute/availabilitySets/', variables('availabilitySetName'))]",
        "[concat('Microsoft.Storage/storageAccounts/', variables('storageAccountName'))]"
      ],
      "properties": {
        "availabilitySet": {
          "id": "[resourceId('Microsoft.Compute/availabilitySets', variables('availabilitySetName'))]"
        },
        "hardwareProfile": {
          "vmSize": "[parameters('vmSize')]"
        },
        "osProfile": {
          "computerName": "[concat(variables('vmName'), '-', copyIndex())]",
          "adminUsername": "[parameters('adminUsername')]",
		      "customData": "[base64(concat('#cloud-config\n\nwrite_files:\n- path: \"/etc/kubernetes/cloud-config\"\n  permissions: 0644\n  content: |\n    {\n    \"cloud\":\"AzurePublicCloud\",\n    \"tenantId\": \"', subscription().tenantId, '\",\n    \"subscriptionId\": \"', subscription().subscriptionId, '\",\n    \"aadClientId\": \"', parameters('aadClientId'), '\",\n    \"aadClientSecret\": \"', parameters('aadClientSecret'), '\",\n    \"resourceGroup\": \"', resourceGroup().name, '\",\n    \"location\": \"', resourceGroup().location, '\",\n    \"subnetName\": \"', variables('subnetName'), '\",\n    \"securityGroupName\": \"', variables('networkSecurityGroupName'), '\",\n    \"vnetName\": \"', variables('vnetName'), '\",\n    \"routeTableName\": \"', variables('routeTableName'), '\",\n    \"vnetResourceGroup\": \"\",\n    \"primaryAvailabilitySetName\": \"', variables('availabilitySetName'), '\",\n    \"cloudProviderBackoff\": false,\n    \"cloudProviderBackoffRetries\": 0,\n    \"cloudProviderBackoffExponent\": 0,\n    \"cloudProviderBackoffDuration\": 0,\n    \"cloudProviderBackoffJitter\": 0,\n    \"cloudProviderRatelimit\": false,\n    \"cloudProviderRateLimitQPS\": 0,\n    \"cloudProviderRateLimitBucket\": 0,\n    \"useManagedIdentityExtension\": false,\n    \"useInstanceMetadata\": true\n    }'))]",
          "linuxConfiguration": {
            "disablePasswordAuthentication": true,
            "ssh": {
              "publicKeys": [
                {
                  "path": "[variables('sshKeyPath')]",
                  "keyData": "[parameters('sshKeyData')]"
                }
              ]
            }
          }
        },
        "storageProfile": {
          "osDisk": {
            "osType": "Linux",
            "name": "[concat(variables('vmName'), '_', copyIndex(), '_osdisk')]",
            "vhd": {
              "uri": "[concat(reference(resourceId('Microsoft.Storage/storageAccounts/', variables('storageAccountName'))).primaryEndpoints.blob, 'vhds/', variables('vmName'), '_', copyIndex(), '_osdisk.vhd')]"
            },            
            "createOption": "FromImage"
          },
          "imageReference": {
            "publisher": "[parameters('imagePublisher')]",
            "offer": "[parameters('imageOffer')]",
            "sku": "[parameters('imageSKU')]",
            "version": "latest"
          }
        },
        "networkProfile": {
          "networkInterfaces": [
            {
              "id": "[resourceId('Microsoft.Network/networkInterfaces', concat(variables('nicName'), '-', copyIndex()))]"
            }
          ]
        }
      }
    }
  ]
}
```

Replace "script": "<Replace it with base64 output from step 2>" with the base64 output from step 2.

NOTE: this script will also genereate a configuration file /etc/kubernetes/cloud-config, the magic is in "customerData" part of above template, it uses [cloud-init](http://cloudinit.readthedocs.io/en/latest/topics/examples.html)

## 4\. Customize ARM template parameters

Create a file called params.json, modify all parametes to suit the needs, fill aadClientId with appId and aadClientSecret with password from Step 1's output.

```json
{
  "$schema": "http://schema.management.azure.com/schemas/2015-01-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "adminUsername": {
      "value": "<Replace it with Admin username>"
    },
    "sshKeyData": {
      "value": "<Replace it with SSH public key>"
    },
    "numberOfInstances": {
      "value": 2
    },
    "imagePublisher": {
      "value": "Canonical"
    },
    "imageOffer": {
      "value": "UbuntuServer"
    },
    "imageSKU": {
      "value": "16.04-LTS"
    },
    "vmSize": {
      "value": "Standard_B2s"
    },
    "aadClientId": {
	    "value": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    },
    "aadClientSecret": {
	    "value": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
	  }    
  }
}
```

## 5\. Deploy ARM template

From shell, begin to deploy ARM template with commands below, replace resource group name and location to suit the needs.

```bash
az group create --name Flannel --location "SouthEast Asia"
az group deployment create --name FlannelDeployment --resource-group Flannel --template-file template.json --parameters @params.json
```

## 6\. Deploy Flannel network with kubeadm

Once VMs get deployed successfully, SSH into the the first node k8snode-{uniquestring}-0, run below commands to deploy K8S

```bash
sudo -i
cd /etc/kubernetes
kubeadm init --config kubeadm.conf
```

kubeadm will output result similar to below if it succeeded without any errors

```bash
[init] Using Kubernetes version: v1.10.2
[init] Using Authorization modes: [Node RBAC]
[init] WARNING: For cloudprovider integrations to work --cloud-provider must be set for all kubelets in the cluster.
	(/etc/systemd/system/kubelet.service.d/10-kubeadm.conf should be edited for this purpose)
[preflight] Running pre-flight checks.
	[WARNING FileExisting-crictl]: crictl not found in system path
Suggestion: go get github.com/kubernetes-incubator/cri-tools/cmd/crictl
[certificates] Generated ca certificate and key.
[certificates] Generated apiserver certificate and key.
[certificates] apiserver serving cert is signed for DNS names [k8snode-342zzth442uje-0 kubernetes kubernetes.default kubernetes.default.svc kubernetes.default.svc.cluster.local k8s.arrteam.top k8snode-342zzth442uje-0.southeastasia.cloudapp.azure.com] and IPs [10.96.0.1 172.16.0.4]
[certificates] Generated apiserver-kubelet-client certificate and key.
[certificates] Generated etcd/ca certificate and key.
[certificates] Generated etcd/server certificate and key.
[certificates] etcd/server serving cert is signed for DNS names [localhost] and IPs [127.0.0.1]
[certificates] Generated etcd/peer certificate and key.
[certificates] etcd/peer serving cert is signed for DNS names [k8snode-342zzth442uje-0] and IPs [172.16.0.4]
[certificates] Generated etcd/healthcheck-client certificate and key.
[certificates] Generated apiserver-etcd-client certificate and key.
[certificates] Generated sa key and public key.
[certificates] Generated front-proxy-ca certificate and key.
[certificates] Generated front-proxy-client certificate and key.
[certificates] Valid certificates and keys now exist in "/etc/kubernetes/pki"
[kubeconfig] Wrote KubeConfig file to disk: "/etc/kubernetes/admin.conf"
[kubeconfig] Wrote KubeConfig file to disk: "/etc/kubernetes/kubelet.conf"
[kubeconfig] Wrote KubeConfig file to disk: "/etc/kubernetes/controller-manager.conf"
[kubeconfig] Wrote KubeConfig file to disk: "/etc/kubernetes/scheduler.conf"
[controlplane] Wrote Static Pod manifest for component kube-apiserver to "/etc/kubernetes/manifests/kube-apiserver.yaml"
[controlplane] Wrote Static Pod manifest for component kube-controller-manager to "/etc/kubernetes/manifests/kube-controller-manager.yaml"
[controlplane] Wrote Static Pod manifest for component kube-scheduler to "/etc/kubernetes/manifests/kube-scheduler.yaml"
[etcd] Wrote Static Pod manifest for a local etcd instance to "/etc/kubernetes/manifests/etcd.yaml"
[init] Waiting for the kubelet to boot up the control plane as Static Pods from directory "/etc/kubernetes/manifests".
[init] This might take a minute or longer if the control plane images have to be pulled.
[apiclient] All control plane components are healthy after 121.002020 seconds
[uploadconfig] Storing the configuration used in ConfigMap "kubeadm-config" in the "kube-system" Namespace
[markmaster] Will mark node k8snode-342zzth442uje-0 as master by adding a label and a taint
[markmaster] Master k8snode-342zzth442uje-0 tainted and labelled with key/value: node-role.kubernetes.io/master=""
[bootstraptoken] Using token: <TOKEN>
[bootstraptoken] Configured RBAC rules to allow Node Bootstrap tokens to post CSRs in order for nodes to get long term certificate credentials
[bootstraptoken] Configured RBAC rules to allow the csrapprover controller automatically approve CSRs from a Node Bootstrap Token
[bootstraptoken] Configured RBAC rules to allow certificate rotation for all node client certificates in the cluster
[bootstraptoken] Creating the "cluster-info" ConfigMap in the "kube-public" namespace
[addons] Applied essential addon: kube-dns
[addons] Applied essential addon: kube-proxy

Your Kubernetes master has initialized successfully!

To start using your cluster, you need to run the following as a regular user:

  mkdir -p $HOME/.kube
  sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
  sudo chown $(id -u):$(id -g) $HOME/.kube/config

You should now deploy a pod network to the cluster.
Run "kubectl apply -f [podnetwork].yaml" with one of the options listed at:
  https://kubernetes.io/docs/concepts/cluster-administration/addons/

You can now join any number of machines by running the following on each node
as root:

  kubeadm join 172.16.0.4:6443 --token <TOKEN> --discovery-token-ca-cert-hash sha256:<DISCOVERY_TOKEN_CA_CERT_HASH>
```

Now, copy kubernetes cluster configuration to $HOME/.kube, essentially kubectl needs this config file to get cluster info.

```bash
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
```

Install Flannel by using below commands

```bash
kubectl apply -f https://raw.githubusercontent.com/coreos/flannel/master/Documentation/kube-flannel.yml
```

Addtionally, if other nodes need to be added into K8S cluster, we can login to k8snode-{uniquestring}-1, ..., k8snode-{uniquestring}-n node, run below commands

```bash
sudo -i
kubeadm join 172.16.0.4:6443 --token <TOKEN> --discovery-token-ca-cert-hash sha256:<DISCOVERY_TOKEN_CA_CERT_HASH>
```
