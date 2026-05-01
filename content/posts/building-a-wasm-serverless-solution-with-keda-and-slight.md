---
title: "Building a WASM Serverless Solution with KEDA HTTP Add-on and Slight Containerd Shim"
slug: "building-a-wasm-serverless-solution-with-keda-and-slight"
date: "2023-01-29 02:29:20"
updated: "2023-09-30 03:05:34"
type: "post"
status: "published"
visibility: "public"
featured: true
excerpt: ""
feature_image: "https://images.unsplash.com/photo-1667372525822-d226d23018dc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwxMTc3M3wwfDF8c2VhcmNofDZ8fHNlcnZlcmxlc3N8ZW58MHx8fHwxNjc0OTU5Mjk2&ixlib=rb-4.0.3&q=80&w=2000"
authors: ["Yingting Huang"]
tags: ["WASM", "WebAssembly", "KEDA", "Kubernetes", "Serverless"]
---
## Introduction

In this article, we will explore how to use KEDA, KEDA HTTP add-on, with Slight Containerd Shim to build a WASM serverless solution. The solution provides scale to/from zero support, reduced time for cold start, and cloud integration capabilities such as Azure blob, App Configuration, ServiceBus etc. The diagram below shows how it works.

![WASM serverless architecture](/assets/posts/building-a-wasm-serverless-solution-with-keda-and-slight/wasm-serverless-architecture.png)

*   Incoming HTTP request is routed through Nginx Ingress Controller to KEDA-HTTP interceptor, the interceptor keeps track of the number of pending HTTP requests - HTTP requests that it has forwarded but the app hasn't returned.
*   KEDA HTTP add-on operator runs insider of Kubernetes cluster, watches for HTTPScaledObject, it creates a ScaledObject for the Deployment specified in the HTTPScaledObject resource.
*   ScaledObject points to interceptor as KEDA external scaler, uses GRPC to get the size of the pending queue. Based on this queue size, it reports scaling metrics as appropriate to KEDA. As the queue size increases, the scaler instructs KEDA to scale up as appropriate.
*   KEDA manages 0<->1 scaling and leverages HPA for 1 <-> n scaling.
*   Kubernetes watches for WASM Pod being created, notices its runtime is wasmtime-slight-v1, leverages slight containerd shim to start SpiderLightning host runtime for WASM application.
*   WASM application receives HTTP request and replies back.

Before jump into the implementation, let's take a close look of those components used in the solution

### WASM

WebAssembly (WASM) is an open standard that defines a portable binary-code format for executable programs. It is designed as a portable compilation target for programming languages, enabling deployment on the web for client and server applications.

WASM allows serverless applications to be faster and more efficient. WASM enables the deployment of scripts and programs that can run on the serverless environment with fewer resources than traditional scripting languages. This makes serverless applications more cost-effective, as well as faster and more reliable. Additionally, using WASM to develop serverless applications allows for easier portability and integration with different platforms.

The Open Container Initiative (OCI) provides support to package WASM application into container image. Generally speaking, a minimal WASM container image is typically a few hundred kilobytes in size. For example, a sample WASM container image used in this solution is only 64.7KB.

IMAGE                                                               TAG                     IMAGE ID            SIZE  
...  
ghcr.io/huangyingting/rust-slight                                   main                    8ce9ccccf9eea       **64.7kB**  
...

### KEDA and KEDA HTTP Add-on

[KEDA](https://keda.sh/) is a Kubernetes-based Event Driven Autoscaler. With KEDA, you can drive the scaling of any container in Kubernetes based on the number of events needing to be processed.

KEDA provides a reliable and well tested solution to scaling your workloads based on external events. However KEDA doesn't provide an HTTP-based scaler. The KEDA HTTP Add-on allows Kubernetes users to automatically scale their HTTP servers up and down (including to/from zero) based on incoming HTTP traffic. Below diagram is copied from KEDA HTTP Add-on [design page](https://github.com/kedacore/http-add-on/blob/main/docs/design.md) and shows how it works here

![KEDA HTTP add-on architecture](/assets/posts/building-a-wasm-serverless-solution-with-keda-and-slight/keda-http-addon-architecture.png)

### SpiderLightning and Slight Containerd Shim

[SpiderLightning](https://github.com/deislabs/spiderlightning)(Slight) is an open source WASM host(based on WasmTime), for building and running fast, secure, and composable cloud microservices with WebAssembly. It defines a set of WebAssembly Interface Types (i.e., WIT) files that abstract distributed application capabilities, such as state management, pub/sub, event driven programming, and more.

[Slight Containerd Shim](https://github.com/deislabs/containerd-wasm-shims#slight-spiderlightning-shim) is a containerd shim powered by the SpiderLightning engine allows you to run WASM applications developed with SpiderLightning SDKs(C and Rust are supported currently)

## Implementation

The solution implementation requires a few of components being deployed, includes

*   Slight Containerd Shim
*   Nginx Ingress Controller
*   KEDA and KEDA HTTP add-on
*   Redis - used by demo application to illustrate SpiderLightning capabilities
*   Sample application and manifests

Detailed steps are

### Install Slight Containerd Shim

Refer to "Deis Labs Containerd Wasm Shims" section from my previous article [Run WASM applications from Kubernetes](/run-wasm-applications-from-kubernetes/)

### Deploy Nginx Ingress Controller

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install ingress-nginx ingress-nginx/ingress-nginx
```

### Deploy KEDA and KEDA HTTP add-on

Deploy KEDA

```bash
helm repo add kedacore https://kedacore.github.io/charts
helm repo update
kubectl create namespace keda
helm install keda kedacore/keda --namespace keda
```

Deploy KEDA HTTP add-on

```bash
helm install http-add-on kedacore/keda-add-ons-http --namespace keda
```

### Deploy Redis

```bash
 helm repo add bitnami https://charts.bitnami.com/bitnami
 helm repo update
 helm install redis bitnami/redis
```

### Sample Application and Manifests

A sample WASM application is created to read/write/delete redis cache, the source code is located at this [repo](https://github.com/huangyingting/wasm/tree/main/rust-slight)

To deploy this application, follow below steps

*   Generate a yaml file with below content, replace `REPLACE_IT_WITH_REDIS_ADDRESS` with redis address, if you followed above redis deployment step, the redis address generally will be redis://redis-master.redis:6379. Replace `REPLACE_IT_WIHT_FQDN` with a FQDN name for external access, for example, rust-slight.yourdomain.com

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: rust-slight
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rust-slight
  namespace: rust-slight
spec:
  replicas: 1
  selector:
    matchLabels:
      app: rust-slight
  template:
    metadata:
      labels:
        app: rust-slight
    spec:
      runtimeClassName: wasmtime-slight
      containers:
        - name: rust-slight
          image: ghcr.io/huangyingting/rust-slight:main
          imagePullPolicy: IfNotPresent
          command: ["/"]
          env:
          - name: REDIS_ADDRESS
            value: REPLACE_IT_WITH_REDIS_ADDRESS
---
apiVersion: v1
kind: Service
metadata:
  name: rust-slight
  namespace: rust-slight
spec:
  type: ClusterIP
  ports:
    - protocol: TCP
      port: 3000
      targetPort: 3000
  selector:
    app: rust-slight
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: rust-slight
  namespace: keda
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
  - host: REPLACE_IT_WIHT_FQDN
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: keda-add-ons-http-interceptor-proxy
            port:
              number: 8080
---
kind: HTTPScaledObject
apiVersion: http.keda.sh/v1alpha1
metadata:
    name: rust-slight
    namespace: rust-slight
spec:
    host: REPLACE_IT_WIHT_FQDN
    targetPendingRequests: 200
    scaleTargetRef:
        deployment: rust-slight
        service: rust-slight
        port: 3000
    replicas:
        min: 0
        max: 10
```

*   Run `kubectl apply -f manifest.yaml` to deploy the application
*   Notice the application is scaled to 0 as currently there is no HTTP request

```bash
kubectl get deploy -n rust-slight 
NAME          READY   UP-TO-DATE   AVAILABLE   AGE
rust-slight   0/0     0            0           34s
```

*   Send a HTTP request to see what happens

```bash
curl http://rust-slight.yourdomain.com/read
```

*   After 1 or 2 seconds, our WASM application echoes HTTP request back

```bash
user-agent: curl/7.81.0
accept: */*
x-forwarded-for: X.X.X.X, 192.168.2.19
x-forwarded-host: rust-slight.yourdomain.com
x-forwarded-port: 80
x-forwarded-proto: http
x-forwarded-scheme: http
x-real-ip: X.X.X.X
x-request-id: 6ccba5facab304b26cbb129b92fca9f6
x-scheme: http
accept-encoding: gzip
```

*   Check deployment again, it is scaled out to 1

```bash
kubectl get deploy -n rust-slight 
NAME          READY   UP-TO-DATE   AVAILABLE   AGE
rust-slight   1/1     1            1           2s
```

*   Application itself supports redis read, write and delete, here are some sample commands that you can play with

```bash
# Write
curl -X PUT -d '{"key": "version", "value": "1.0.0"}' http://rust-slight.yourdomain.com/create
# Update
curl -X POST -d '{"key": "version", "value": "1.0.1"}' http://rust-slight.yourdomain.com/update
# Delete
curl -X DELETE -d '{"key": "version"}' http://rust-slight.yourdomain.com/delete
# Read
curl http://rust-slight.yourdomain.com/read
```
