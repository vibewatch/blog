---
title: "Using Let's Encrypt to Sign a Certificate"
slug: "using-lets-encrypt-to-sign-a-certificate"
date: "2018-05-24 06:27:35"
updated: "2018-05-24 14:17:54"
type: "post"
status: "published"
visibility: "public"
featured: false
excerpt: ""
feature_image: "/assets/posts/using-lets-encrypt-to-sign-a-certificate/hero.png"
authors: ["Yingting Huang"]
tags: ["Azure", "Linux", "SSL", "Certificate", "Certbot"]
---
First of all, a private key is needed before generating a signing request. You can either use OpenSSL:

```bash
openssl genrsa -out ~/domain.com.ssl/domain.com.key 2048
openssl req -new -sha256 -key ~/domain.com.ssl/domain.com.key -out ~/domain.com.ssl/domain.com.csr
```

or use Azure Key Vault, especially if you want to store the certificate in Azure.

1.  From Key Vault, go to SETTINGS -> Certificates -> Generate/Import, and set "Type of Certificate Authority (CA)" to "Certificate issued by a non-integrated CA".
    ![create_a_certificate](/assets/posts/using-lets-encrypt-to-sign-a-certificate/create-a-certificate.jpg)
2.  Click the key created just now, choose "Certificate Operation"->"Download CSR" to download the CSR as domain.com.csr  
    ![download_csr](/assets/posts/using-lets-encrypt-to-sign-a-certificate/download-csr.jpg)  
    Now we are going to sign the certificate by using [certbot](https://certbot.eff.org/). Here are the steps:

```bash
sudo -i
add-apt-repository ppa:certbot/certbot
apt-get update
apt-get install certbot
ufw allow 80
ufw allow 443
certbot certonly --standalone --register-unsafely-without-email --csr <your_key_csr>.csr
```

If Azure key vault is being used, we need to "Merge Signed Request"  
![merge_signed_request](/assets/posts/using-lets-encrypt-to-sign-a-certificate/merge-signed-request.jpg)
