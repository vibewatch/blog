---
title: "Deploy Traefik2 Ingress with Cert-Manager and Azure AD Authentication"
slug: "using-traefik-ingress-with-cert-manager-and-aad-authentication"
date: "2020-04-23 03:04:21"
updated: "2020-04-23 03:06:10"
type: "post"
status: "published"
visibility: "public"
featured: true
excerpt: "This article discuss on how to integrate your application with traefik2 for azure ad authentcation, automatic certificate generate as well as multiple traefik instances support for community version."
feature_image: "/assets/posts/using-traefik-ingress-with-cert-manager-and-aad-authentication/hero.png"
authors: ["Yingting Huang"]
tags: ["Kubernetes", "Traefik", "Traefik2", "AAD", "AzureAD"]
---
# 0 Define the problem

The requirement is simple, I'd like to

1.  Have newest traefik verion(2.2, at the time of writing this blog) deployed in my environment so that I can try new features
2.  Support Azure AD authentication proxy(similar like oauth2\_proxy) to protect my website
3.  Use ingress instead of ingressroute(traefik) so I have the flexiabilty to switch between different ingress controllers.
4.  Support automatic certificate generation.
5.  Scale out traefik pod to support load balancing

After spending a few of hours in researching and testing, here is the result I come up with  
![Traefik, cert-manager, and Azure AD architecture](/assets/posts/using-traefik-ingress-with-cert-manager-and-aad-authentication/traefik-cert-manager-aad-architecture.png)

1.  AAD authentication can be arhieved by using traefik auth forward, refer to this [link](https://github.com/thomseddon/traefik-forward-auth)
2.  Traefik supports automatic certificate generation but limits to 1 replica, so the solution here is using cert-manager plus traefik
3.  Traefik 2.2 adds ingress annotations back, so I am going to use the ingress annotations on ingress object. Details can be found from this [link](https://docs.traefik.io/master/routing/providers/kubernetes-ingress/)

# 1 Solution

Here are detailed steps

## 1.1 Deploy traefik 2

The helm chart is available from this [link](https://github.com/containous/traefik-helm-chart), by default, this chart exposes traefik web and websecure ports to 8000 and 8443, as we are creating internet facing webapp/website, we need to override those settings to 80 and 443. Configurations `entrypoints.web.http.redirections.entrypoint.to=websecure` and `entrypoints.web.http.redirections.entrypoint.scheme=https` are used to force all http traffics redirect to https port, configuration `providers.kubernetesingress.ingressclass=traefik2` defines our ingress class to traefik2, which is going to be used in ingress annotation so that cert-manager can decide which ingress controller it will hook up.

```sh
helm install traefik traefik/traefik -n=traefik --set="additionalArguments={--providers.kubernetesingress,--providers.kubernetesingress.ingressclass=traefik2,--metrics.prometheus=true,--entrypoints.web.http.redirections.entrypoint.to=websecure,--entrypoints.web.http.redirections.entrypoint.scheme=https}",ports.web.port=80,ports.websecure.port=443
```

## 1.2 Deploy and configure cert-manager

If cert-manager hasn't been deployed, use below command to deploy it  
`kubectl apply --validate=false -f https://github.com/jetstack/cert-manager/releases/download/v0.14.1/cert-manager.yaml`  
Refer to [link](https://cert-manager.io/docs/installation/kubernetes/)  
NOTE: At the time of writing, cert-manager helm3 deployment seems still have issues with namespace deleting as crd webhook will get failed.

Once cert-manager is deployed, we need to define our clusterissuer to support traefik annotation, use the template in below and run `kubectl apply -f cluster_issuer_traefik2.yaml` to add our own traefik2 clusterissuer

```yaml
# filename cluster_issuer_traefik2.yaml
apiVersion: cert-manager.io/v1alpha2
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging-traefik2
spec:
  acme:

    # You must replace this email address with your own.
    # Let's Encrypt will use this to contact you about expiring
    # certificates, and issues related to your account.
    email: yourself@yourdomain.com

    # ACME server URL for Let’s Encrypt’s staging environment.
    # The staging environment will not issue trusted certificates but is
    # used to ensure that the verification process is working properly
    # before moving to production
    server: https://acme-staging-v02.api.letsencrypt.org/directory

    privateKeySecretRef:
      # Secret resource used to store the account's private key.
      name: letsencrypt-secret

    # Enable the HTTP-01 challenge provider
    # you prove ownership of a domain by ensuring that a particular
    # file is present at the domain
    solvers:
    - http01:
        ingress:
            class: traefik2
---

apiVersion: cert-manager.io/v1alpha2
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod-traefik2
spec:
  acme:

    # You must replace this email address with your own.
    # Let's Encrypt will use this to contact you about expiring
    # certificates, and issues related to your account.
    email: yourself@yourdomain.com

    # ACME server URL for Let’s Encrypt’s staging environment.
    # The staging environment will not issue trusted certificates but is
    # used to ensure that the verification process is working properly
    # before moving to production
    server: https://acme-v02.api.letsencrypt.org/directory

    privateKeySecretRef:
      # Secret resource used to store the account's private key.
      name: letsencrypt-secret

    # Enable the HTTP-01 challenge provider
    # you prove ownership of a domain by ensuring that a particular
    # file is present at the domain
    solvers:
    - http01:
        ingress:
            class: traefik2
```

## 1.3 Deploy application

This post suppose we already have our webapp/website application running from "app" namespace. To integrate the application with Azure AD authentication, we need to register an application in Azure AD, to do that

1.  Log in to Azure Portal and click Azure Active Directory in the side menu.
2.  Click App Registrations and add a new application registration:  
    Name: <your app name>  
    Application type: Web app / API  
    Sign-on URL: https://<your app domain>/\_oauth
3.  Click the name of the new application to open the application details page.  
    Click Endpoints. Note down the "OpenID Connect metadata document" then remove "/.well-known/openid-configuration", this will be the endpoint url. For example, if the "OpenID Connect metadata document" is [https://login.microsoftonline.com/12345678-1234-1234-1234-123456789123/v2.0/.well-known/openid-configuration](https://login.microsoftonline.com/12345678-1234-1234-1234-123456789123/v2.0/.well-known/openid-configuration), then the endppoint url will be [https://login.microsoftonline.com/12345678-1234-1234-1234-123456789123/v2.0](https://login.microsoftonline.com/12345678-1234-1234-1234-123456789123/v2.0)
4.  Close the Endpoints page to come back to the application details page.  
    Note down the “Application ID”, this will be the OAuth client id.
5.  Click Certificates & secrets and add a new entry under Client secrets.  
    Description: <your app description>  
    Expires: Never  
    Click Add then copy the key value, this will be the OAuth client secret.

Now, we are going to deploy traefik auth forwarder in "auth" namespace, and an ingress object in "app" namespace, let's create two namespaces first

```sh
kubectl create ns auth
kubectl create ns app
```

We also need to generate a secret to be used in Azure AD authentication, here is the script

```sh
CLIENT_ID=<Client ID in step 3>
CLIENT_SECRET=<Client secret in step 4>
ENDPOINT=<Endpoint in step 2>
RANDOM_SECRET=<Some random string>

cat <<EOF > azuread.yaml
apiVersion: v1
data:
  client_id: $(echo -n $CLIENT_ID | base64 --wrap=0)
  client_secret: $(echo -n $CLIENT_SECRET | base64 --wrap=0)
  endpoint: $(echo -n $ENDPOINT | base64 --wrap=0)
  random_secret: $(echo -n $RANDOM_SECRET | base64 --wrap=0)
kind: Secret
metadata:
  name: azuread
  namespace: auth
type: Opaque
EOF
```

Run `kubectl apply -f azuread.yaml` to create the secret.

Now we are all set, to make the application integrated with Azure AD authentication and traefik, we need to deploy traefik auth forwarder and create ingress objects.

The template is attached in below and it requires a little bit customization firstable, modify "auth.yourdomain.com" to your real domain name created for traefik auth forwarder, and modify "app.yourdomain.com" to your real app domain name. Make sure both auth.yourdomain.com and app.yourdomain.com are pointing to the external load balancer IP address of traefik service. To get traefik service external IP, you can run

```sh
k get svc -n=traefik        
NAME      TYPE           CLUSTER-IP       EXTERNAL-IP     PORT(S)                      AGE
traefik   LoadBalancer   10.106.236.114   20.44.210.X   80:32095/TCP,443:32616/TCP   4d17h
```

Note down EXTERNAL-IP, make sure in your DNS domain, both "auth.yourdomain.com" and "app.yourdomain.com" are pointing to EXTERNAL-IP.

Then apply all those configurations with `kubectl apply -f app_auth_all_in_one.yaml` to create traefik auth forwarder and two ingress objects, one is used to handle Azure AD authentication(auth-ingress), another is used to handle webapp/website traffics(app-ingress).

```yaml
# filename app_auth_all_in_one.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app: traefik-forward-auth
  name: traefik-forward-auth
  namespace: auth
spec:
  replicas: 1
  selector:
    matchLabels:
      app: traefik-forward-auth
  template:
    metadata:
      labels:
        app: traefik-forward-auth
    spec:
      containers:
        - name: traefik-forward-auth
          image: thomseddon/traefik-forward-auth:latest
          ports:
            - containerPort: 4181
              protocol: TCP
          env:
            - name: DEFAULT_PROVIDER
              value: "oidc"
            - name: PROVIDERS_OIDC_ISSUER_URL
              valueFrom:
                secretKeyRef:
                  name: azuread
                  key: endpoint
            - name: PROVIDERS_OIDC_CLIENT_ID
              valueFrom:
                secretKeyRef:
                  name: azuread
                  key: client_id
            - name: PROVIDERS_OIDC_CLIENT_SECRET
              valueFrom:
                secretKeyRef:
                  name: azuread
                  key: client_secret
            - name: SECRET
              valueFrom:
                secretKeyRef:
                  name: azuread
                  key: random_secret
            - name: COOKIE_DOMAIN
              value: app.yourdomain.com
            - name: AUTH_HOST
              value: auth.yourdomain.com
            - name: LOG_LEVEL
              value: trace
          resources:
            limits:
              memory: "256Mi"
              cpu: "200m"
---
kind: Service
apiVersion: v1
metadata:
  name: traefik-forward-auth
  namespace: auth
spec:
  selector:
    app: traefik-forward-auth
  ports:
    - name: http
      port: 80
      targetPort: 4181
      protocol: TCP
---
apiVersion: traefik.containo.us/v1alpha1
kind: Middleware
metadata:
  name: azuread
  namespace: auth
spec:
  forwardAuth:
    address: http://traefik-forward-auth.auth
    authResponseHeaders:
      - X-Forwarded-User
---
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  annotations:
    kubernetes.io/ingress.class: traefik2
    cert-manager.io/cluster-issuer: letsencrypt-prod-traefik2
    traefik.ingress.kubernetes.io/router.entrypoints: web,websecure
    traefik.ingress.kubernetes.io/router.tls: "true"
    traefik.ingress.kubernetes.io/router.middlewares: auth-azuread@kubernetescrd
  name: auth-ingress
  namespace: auth
spec:
  rules:
  - host: auth.yourdomain.com
    http:
      paths:
      - backend:
          serviceName: traefik-forward-auth
          servicePort: 80
        path: /
  tls:
  - hosts:
    - auth.yourdomain.com
    secretName: auth-tls
---
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  annotations:
    kubernetes.io/ingress.class: traefik2
    cert-manager.io/cluster-issuer: letsencrypt-prod-traefik2
    traefik.ingress.kubernetes.io/router.entrypoints: web,websecure
    traefik.ingress.kubernetes.io/router.tls: "true"
    traefik.ingress.kubernetes.io/router.middlewares: auth-azuread@kubernetescrd
  name: app
  namespace: app
spec:
  rules:
  - host: app.yourdomain.com
    http:
      paths:
      - backend:
          serviceName: app
          servicePort: 80
        path: /
  tls:
  - hosts:
    - app.yourdomain.com
    secretName: app-tls
```

A little bit explanation about the template

1.  forwardAuth middleware is used to delegate the authentication to an external service, in our case it is traefik-forward-auth. For details, please refer to [link](https://docs.traefik.io/middlewares/forwardauth/)
2.  Traefik 2.2 introduces annotation back, to use the middleware in ingress, we need to use traefik.ingress.kubernetes.io/router.middlewares: <namespace>-<middleware\_name>@kubernetescrd, that's the reason we need to add "auth-" for "azuread" middleware, so the completed name will be "auth-azuread@kubernetescrd".

Now you should have traefik as an edge router and Azure AD authentication to protect your applicatin.
