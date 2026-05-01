---
title: "Enable WAF with Modsecurity from Ingress Nginx"
slug: "enable-waf"
date: "2021-09-30 01:23:31"
updated: "2022-11-10 01:00:15"
type: "post"
status: "published"
visibility: "public"
featured: false
excerpt: ""
feature_image: "/assets/posts/enable-waf/hero.png"
authors: ["Yingting Huang"]
tags: []
---
## Export modsecurity.conf from ingress nginx controller

POD\_NAME=$(kubectl get pods --namespace ingress-nginx -l "app.kubernetes.io/component=controller,app.kubernetes.io/name=ingress-nginx" -o jsonpath="{.items\[0\].metadata.name}")

kubectl exec -it $POD\_NAME -n ingress-nginx -- cat /etc/nginx/modsecurity/modsecurity.conf > modsecurity.conf

## Change configuration to support JSON and serial log

\# SecAuditLogType Concurrent  
\# SecAuditLog /var/log/modsec\_audit.log

SecAuditLogType Serial  
SecAuditLog /dev/stdout  
SecAuditLogFormat JSON

## Create a configmap to use customized modsecurity.conf settings

kubectl create configmap modsecurity --from-file=modsecurity.conf=modsecurity.conf -n=ingress-nginx

## Update ingress nginx helm values

```yaml
  extraVolumeMounts:
  ## Additional volumeMounts to the controller main container.
    - name: modsecurity
      mountPath: /etc/nginx/modsecurity/modsecurity.conf
      subPath: modsecurity.conf
      readOnly: true

  extraVolumes:
  ## Additional volumes to the controller pod.
    - name: modsecurity
      configMap:
        name: modsecurity
```

helm upgrade <name> ingress-nginx/ingress-nginx -n ingress-nginx -f nginx\_values.yaml

## Create nginx ingress object and annotate it in below

```yaml
    nginx.ingress.kubernetes.io/enable-modsecurity: "true"
    nginx.ingress.kubernetes.io/enable-owasp-core-rules: "true"
    nginx.ingress.kubernetes.io/modsecurity-snippet: |
      # SecRuleEngine Off|On|DetectionOnly
      SecRuleEngine On
      SecRuleRemoveById 920350
```

## Test

Here are some commands to test modsecurity WAF protection

```
curl -X POST YOUR_URL -F "user='<script><alert>Hello></alert></script>'"
curl -X POST YOUR_URL -F "user='AND 1=1;"
```
