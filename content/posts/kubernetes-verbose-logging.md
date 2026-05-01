---
title: "Kubernetes Verbose Logging"
slug: "kubernetes-verbose-logging"
date: "2019-01-01 06:29:50"
updated: "2019-01-01 06:29:50"
type: "post"
status: "published"
visibility: "public"
featured: false
excerpt: ""
feature_image: "/assets/posts/kubernetes-verbose-logging/hero.jpg"
authors: ["Yingting Huang"]
tags: ["Kubernetes", "K8S"]
---
# Kubectl Verbose Logging

```bash
kubectl -v=10 get pod
```

# Kubernetes Core Components Logging

From /etc/kubernetes/manifests, edit \*.yaml files, add -v=10 switch
