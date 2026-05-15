---
title: "Yet Another Way to Troubleshoot K8S Applications"
slug: "yet-another-way-to-troubleshoot-k8s-apps"
date: "2018-12-25 08:02:07"
updated: "2018-12-30 09:14:42"
type: "post"
status: "published"
visibility: "public"
featured: true
excerpt: ""
feature_image: "/assets/posts/yet-another-way-to-troubleshoot-k8s-apps/hero.jpg"
authors: ["Yingting Huang"]
tags: ["Kubernetes", "Linux", "Network", "K8S", "Docker"]
---
# Yet Another Way to Troubleshoot K8S Applications

There are plenty of articles explaining how to debug K8S applications, for example:

*   [Troubleshoot Applications  
    ](https://kubernetes.io/docs/tasks/debug-application-cluster/debug-application/)
*   [Connect with SSH to Azure Kubernetes Service (AKS) cluster nodes for maintenance or troubleshooting  
    ](https://docs.microsoft.com/en-us/azure/aks/ssh)

Due to the nature of container isolation, an application running from a container uses its own namespaces and cgroups, and the container image is usually kept as small as possible. Thus, debugging an application running in a container can be challenging. The container itself usually lacks debugging tools. For example, capturing a network trace requires tcpdump, but most of the time, the container image won't include it.

This article explains how to use [nsenter](http://man7.org/linux/man-pages/man1/nsenter.1.html) to debug applications running from K8S cluster. nsenter basically

> run program with namespaces of other processes

With nsenter, you can access the container's namespace and use commands available on the host.

To use nsenter, we need to get the process ID of the application running in the container. Here are the steps.

## 1.List containers and container IDs

Running the command below from the K8S master node (Linux) will output all containers and their corresponding Docker IDs. Since a Pod can have one or more containers, some Pods will have multiple container names and Docker IDs in the output.

```bash
kubectl get pods --all-namespaces -o=custom-columns=NAMESPACE:.metadata.namespace,NAME:.metadata.name,NODE:.spec.nodeName,CONTAINERS:.spec.containers[*].name,CONTAINERIDS:.status.containerStatuses[*].containerID | sed -e 's/docker:\/\/\(.\{12\}\).\{52\}/\1/g'
```

Below is the sample output from my K8S cluster

```bash
NAMESPACE     NAME                                                   NODE                        CONTAINERS                      
...
NAMESPACE     NAME                                                   NODE                        CONTAINERS                      CONTAINERIDS
...
ghost         arracs-ghost-754d44cf5c-pg4bp                          k8s-agentpool1-30506800-0   arracs-ghost                    555d5bc1f3de
ghost         arracs-ghost-mariadb-0                                 k8s-agentpool1-30506800-1   mariadb                         2af387235184
...
kube-system   kube-dns-8446b8bd4c-9ssgl                              k8s-agentpool1-30506800-1   kubedns,dnsmasq,sidecar         3b2fd4125a81,a6ecc2a6517f,353afb14b350
...
```

For example, container arracs-ghost is running on agent node k8s-agentpool1-30506800-0 and its container ID is 555d5bc1f3de. In the following steps, we will use this container ID for demonstration purposes.

**Note**: Running above command from Windows won't work as `sed` is not available from Windows. So in Windows, just remove `| sed -e 's/docker:\/\/\(.\{12\}\).\{52\}/\1/g'` of above command, then from output, find string similar like docker://3b2fd4125a81ffc061ee938b5fd3e4286b801187318ea3f3a3e93fcef9381015, the highlighted 12 characters is container ID.

## 2\. Map container ID to PID

To map the container ID to a PID, we need to SSH into agent node k8s-agentpool1-30506800-0, then run `docker inspect --format '{{ .State.Pid }}' 555d5bc1f3de`. It will output the PID; in our case, the PID is `15599`.

To SSH into an agent node, refer to [Connect with SSH to Azure Kubernetes Service (AKS) cluster nodes for maintenance or troubleshooting](https://docs.microsoft.com/en-us/azure/aks/ssh). If it is an Azure VM, assign a public IP address to its NIC, then follow the article [SSH troubleshooting](https://docs.microsoft.com/en-us/azure/virtual-machines/troubleshooting/troubleshoot-ssh-connection) to add a user for login.

## 3\. Enter network namespace

Now with the PID, we are able to enter the application's network namespace. A sample command is `sudo nsenter -t 15599 -n`. From that namespace, you will be able to run any commands available on the agent node inside the container's network namespace. For example, before entering the container's network namespace, `ifconfig -a` on the agent node looks like this:

```bash
ifconfig
azure0    Link encap:Ethernet  HWaddr 00:0d:3a:a0:64:b0  
          inet addr:10.240.0.35  Bcast:0.0.0.0  Mask:255.240.0.0
          inet6 addr: fe80::20d:3aff:fea0:64b0/64 Scope:Link
          UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1
          RX packets:1920464 errors:0 dropped:0 overruns:0 frame:0
          TX packets:2445984 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1000 
          RX bytes:2739355202 (2.7 GB)  TX bytes:606845859 (606.8 MB)

azv06977889865 Link encap:Ethernet  HWaddr 32:ec:84:52:84:e8  
          inet6 addr: fe80::30ec:84ff:fe52:84e8/64 Scope:Link
          UP BROADCAST RUNNING  MTU:1500  Metric:1
          RX packets:0 errors:0 dropped:0 overruns:0 frame:0
          TX packets:45905 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1000 
          RX bytes:0 (0.0 B)  TX bytes:1930882 (1.9 MB)

...

docker0   Link encap:Ethernet  HWaddr 02:42:89:1c:aa:6a  
          inet addr:172.17.0.1  Bcast:172.17.255.255  Mask:255.255.0.0
          UP BROADCAST MULTICAST  MTU:1500  Metric:1
          RX packets:0 errors:0 dropped:0 overruns:0 frame:0
          TX packets:0 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:0 
          RX bytes:0 (0.0 B)  TX bytes:0 (0.0 B)

eth0      Link encap:Ethernet  HWaddr 00:0d:3a:a0:64:b0  
          inet6 addr: fe80::20d:3aff:fea0:64b0/64 Scope:Link
          UP BROADCAST RUNNING  MTU:1500  Metric:1
          RX packets:7484022 errors:0 dropped:0 overruns:0 frame:0
          TX packets:3124398 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1000 
          RX bytes:8152611809 (8.1 GB)  TX bytes:885562888 (885.5 MB)

lo        Link encap:Local Loopback  
          inet addr:127.0.0.1  Mask:255.0.0.0
          inet6 addr: ::1/128 Scope:Host
          UP LOOPBACK RUNNING  MTU:65536  Metric:1
          RX packets:22171 errors:0 dropped:0 overruns:0 frame:0
          TX packets:22171 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1000 
          RX bytes:18088794 (18.0 MB)  TX bytes:18088794 (18.0 MB)
```

After entering the container's network namespace, `ifconfig -a` shows the output below, which is indeed the container's network configuration.

```bash
eth0      Link encap:Ethernet  HWaddr 4a:18:c7:56:ab:ab  
          inet addr:10.240.0.45  Bcast:0.0.0.0  Mask:255.240.0.0
          UP BROADCAST RUNNING  MTU:1500  Metric:1
          RX packets:186316 errors:0 dropped:0 overruns:0 frame:0
          TX packets:153705 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1000 
          RX bytes:3333925122 (3.3 GB)  TX bytes:62593512 (62.5 MB)

lo        Link encap:Local Loopback  
          inet addr:127.0.0.1  Mask:255.0.0.0
          UP LOOPBACK RUNNING  MTU:65536  Metric:1
          RX packets:0 errors:0 dropped:0 overruns:0 frame:0
          TX packets:0 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1000 
          RX bytes:0 (0.0 B)  TX bytes:0 (0.0 B)
```

If we run `tcpdump -i eth0`, it will capture all traffic on the container's eth0 interface.

## 4\. Enter mount namespace

To enter the mount namespace, run `sudo nsenter -t 15599 -m`. This command is useful for accessing mounted volumes inside a container.

## 5\. Quit from nsenter

To quit from the container's namespace, simply type `exit`; it will return to the agent node's shell.

## 6\. Run command directly with nsenter

We can also add a sub-command directly to the end of nsenter's command, for example, `sudo nsenter -t 15599 -n ip addr`, it will just run `ip addr` inside of container's network namespace and output the result.
