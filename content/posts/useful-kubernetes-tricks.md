---
title: "Useful Kubernetes Tricks"
slug: "useful-kubernetes-tricks"
date: "2019-09-23 01:36:00"
updated: "2019-11-03 00:09:53"
type: "post"
status: "published"
visibility: "public"
featured: true
excerpt: ""
feature_image: "/assets/posts/useful-kubernetes-tricks/hero.jpg"
authors: ["Yingting Huang"]
tags: ["Kubernetes", "Linux"]
---
## Find which RoleBinding/ClusterRoleBinding is related to a ServiceAccount

```bash
kubectl get clusterrolebindings -o json | jq -r '
  .items[] | 
  select(
    .subjects // [] | .[] | 
    [.kind,.namespace,.name] == ["ServiceAccount","kube-system","node-controller"]
  ) |
  .metadata.name'
```

```bash
kubectl get clusterrolebindings -o json | jq -r '.items[] | select(.subjects // [] | .[] | [.name] == ["<YOUR_ACCOUNT_NAME>"] ) |  .metadata.name'

kubectl get rolebindings --all-namespaces -o json | jq -r '.items[] | select(.subjects // [] | .[] | [.name] == ["<YOUR_ACCOUNT_NAME>"] ) |  .metadata.name'
```

## Force iptables re-sync

```bash
kubectl delete pod -l component=kube-proxy -n kube-system
```

## Delete namespace in terminating state

1.  kubectl get namespace <your\_namespace> -o json > tmp.json
2.  Open tmp.json and remove any lines from finalizers. Just save it!
3.  kubectl proxy
4.  curl -k -H "Content-Type: application/json" -X PUT --data-binary @tmp.json [http://127.0.0.1:8001/api/v1/namespaces/](http://127.0.0.1:8001/api/v1/namespaces/)<your\_namespace>/finalize
5.  kubectl delete namespace <your\_namespace>
6.  If you have any other namespaces that you want to delete, just replace <your\_namespace> with new namespace name.

## Downgrade Helm Application

helm install stable/nginx-ingress --version v0.23.0

## Batch Delete CustomResourceDefinition/Secret

```bash
kubectl get customresourcedefinition  | grep 'kubeless'|awk '{print $1}'|xargs kubectl delete customresourcedefinition

kubectl get secret --all-namespaces | grep 'istio' |awk '{print $1 " " $2}' | xargs -n2 sh -c 'kubectl delete secret -n $0 $1'
```
