---
title: "Kubernetes Horizontal Pod Autoscaler"
slug: "kubernetes-horizontal-pod-autoscaler"
date: "2019-01-23 13:29:30"
updated: "2019-01-23 13:29:30"
type: "post"
status: "published"
visibility: "public"
featured: false
excerpt: ""
feature_image: "/assets/posts/kubernetes-horizontal-pod-autoscaler/hero.jpg"
authors: ["Yingting Huang"]
tags: ["Kubernetes"]
---
This post just serves as a quickstart for kubernetes horizontal pod autosacler testing purpose, here are the steps

```bash
git clone https://github.com/Azure-Samples/azure-voting-app-redis.git
cd azure-voting-app-redis
kubectl apply -f azure-vote-all-in-one-redis.yaml
kubectl autoscale deployment azure-vote-front --cpu-percent=10 --min=1 --max=10
```

After finish above commands, you should have hpa configured, now we need to generate some workload, here are the steps

```bash
kubectl run -i --tty busybox --image=busybox /bin/sh
```

From the busybox, type below command to generate workload

```bash
while true; do wget -q -O- http://azure-vote-front; done
```

Wait for a while, you will see hpa works now and autoscales pod instances.

```bash
kubectl get hpa
NAME               REFERENCE                     TARGETS   MINPODS   MAXPODS   REPLICAS   AGE
azure-vote-front   Deployment/azure-vote-front   58%/10%   1         5         1          7m
```

```bash
kubectl get pod
NAME                               READY   STATUS    RESTARTS   AGE
azure-vote-back-f9cc849fb-vz7n2    1/1     Running   0          15m
azure-vote-front-6b8f58d8d-f6mw6   1/1     Running   0          15m
azure-vote-front-6b8f58d8d-lbq22   1/1     Running   0          21s
azure-vote-front-6b8f58d8d-q2gs8   1/1     Running   0          21s
azure-vote-front-6b8f58d8d-wc9tt   1/1     Running   0          21s
busybox-7cd98849ff-zpk9b           1/1     Running   1          2m
```
