---
title: "How to Set Up an OpenVPN Server on Azure"
slug: "how-to-setup-an-openvpn-server-on-azure"
date: "2018-05-19 09:34:42"
updated: "2019-01-02 09:09:53"
type: "post"
status: "published"
visibility: "public"
featured: false
excerpt: ""
feature_image: "/assets/posts/how-to-setup-an-openvpn-server-on-azure/hero.png"
authors: ["Yingting Huang"]
tags: ["OpenVPN", "Azure"]
---
# How to Set Up an OpenVPN Server on Azure

In this article, I will provide detailed steps to set up an OpenVPN server in Azure.

## Prerequisites

*   An Ubuntu 16.04 VM deployed in Azure with at least one NIC that has a public IP address enabled.
*   A user with sudo privileges on the Ubuntu 16.04 VM.
*   The VM private IP address does not overlap with subnet 172.16.0.0/24.

## Step 1: Install OpenVPN & Easy-RSA

```bash
sudo apt-get update
apt-get install openvpn easy-rsa
```

## Step 2: Set Up CA

Create the CA directory.

```bash
make-cadir ~/openvpn-ca
```

Open vars file to configure the settings

```bash
cd ~/openvpn-ca
vi vars
```

Find and modify the following settings:

```bash
export KEY_COUNTRY="YOUR_COUNTRY"
export KEY_PROVINCE="YOUR_PROVINCE"
export KEY_CITY="YOUR_CITY"
export KEY_ORG="YOUR_ORG"
export KEY_EMAIL="YOUR_EMAIL@YOUR_DOMAIN.SUFFIX"
export KEY_OU="YOUR_OU"

export KEY_NAME="YOUR_KEY_NAME"
```

After saving the modified `vars` file, set up the CA by typing the following commands:

```bash
cd ~/openvpn-ca
source vars
# 
./clean-all
./build-ca
```

## Step 3: Create Server Certificates

```bash
./build-key-server ovpn
KEY_SIZE=4096 ./build-dh
openvpn --genkey --secret keys/ta.key
```

## Step 4: Configure OpenVPN Service

Copy certificates to /etc/openvpn.

```bash
cd ~/openvpn-ca/keys
sudo cp ca.crt ovpn.crt ovpn.key ta.key dh4096.pem /etc/openvpn
sudo adduser --system --shell /usr/sbin/nologin --no-create-home openvpn
```

Create the server-side configuration file.

```bash
sudo vi /etc/openvpn/server.conf
```

Add the following content to server.conf.

```bash
# OpenVPN listening address
local 10.0.1.6
# OpenVPN listening port
port 32768 
# tcp/udp
proto udp
dev tun
ca ca.crt
cert ovpn.crt
key ovpn.key
dh dh4096.pem
# OpenVPN network
server 172.16.0.0 255.255.255.0
ifconfig-pool-persist ipp.txt
# Redirect all traffic to OpenVPN
push "redirect-gateway def1 bypass-dhcp"
keepalive 10 120
# This file is secret
tls-auth ta.key 0
# Cipher settings
cipher AES-256-CBC
auth SHA512
tls-cipher TLS-DHE-RSA-WITH-AES-256-GCM-SHA384:TLS-DHE-RSA-WITH-AES-128-GCM-SHA256:TLS-DHE-RSA-WITH-AES-256-CBC-SHA:TLS-DHE-RSA-WITH-CAMELLIA-256-CBC-SHA:TLS-DHE-RSA-WITH-AES-128-CBC-SHA:TLS-DHE-RSA-WITH-CAMELLIA-128-CBC-SHA
comp-lzo
user openvpn 
group nogroup
persist-key
persist-tun
log        /var/log/openvpn.log
log-append  openvpn.log
verb 4 
```

ESC, type ":wq" to save the file.

## Step 5: Configure Iptables and Routing

Configure iptables so that it can work in the Azure environment. Because all traffic will be routed from the public IP address to the private IP address bound to a specific NIC, replace `ethx` with the real NIC device name.

```bash
# iptables configuration for openvpn
sudo iptables -A INPUT -i ethx -p udp -m state --state NEW -m udp --dport 32768 -j ACCEPT
sudo iptables -A INPUT -i tun+ -j ACCEPT
sudo iptables -A FORWARD -i tun+ -j ACCEPT
sudo iptables -A OUTPUT -o tun+ -j ACCEPT
sudo iptables -A FORWARD -i tun+ -o ethx -m state --state RELATED,ESTABLISHED -j ACCEPT
sudo iptables -A FORWARD -i ethx -o tun+ -m state --state RELATED,ESTABLISHED -j ACCEPT
sudo iptables -t nat -A POSTROUTING -s 172.16.0.0/24 -o ethx -j MASQUERADE
```

Permanently enable the IP forwarding by editing /etc/sysctl.conf and adding the following line

```bash
sudo vi /etc/sysctl.conf
net.ipv4.ip_forward = 1
:wq
sudo sysctl -p /etc/sysctl.conf
```

If the VM has multiple NICs and their IPs are all in the same subnet:

```bash
sudo bash -c "echo '200 ethx-rt' >> /etc/iproute2/rt_tables"
sudo vi /etc/network/interfaces.d/ethx.cfg
```

Add the following configuration to ethx.cfg.

```bash
auto ethx
iface ethx inet dhcp
    post-up ip route add 10.0.1.0/24 dev ethx src 10.0.1.6 table ethx-rt
    post-up ip route add default via 10.0.1.1 dev ethx table ethx-rt
    post-up ip rule add from 10.0.1.6/32 table ethx-rt
    post-up ip rule add to 10.0.1.6/32 table ethx-rt
    post-up ip rule add from 172.16.0.0/24 table ethx-rt
```

**NOTE**: Please replace `ethx` with the real NIC name.

## Step 6: Start and Enable OpenVPN Service

Start the OpenVPN service.

```bash
sudo systemctl start openvpn@server
sudo systemctl status openvpn@server
```

Check openvpn service's status

```bash
● openvpn@server.service - OpenVPN connection to server
   Loaded: loaded (/lib/systemd/system/openvpn@.service; enabled; vendor preset: enabled)
   Active: active (running) since Fri 2018-05-18 11:57:04 UTC; 11h ago
     Docs: man:openvpn(8)
           https://community.openvpn.net/openvpn/wiki/Openvpn23ManPage
           https://community.openvpn.net/openvpn/wiki/HOWTO
  Process: 1921 ExecStart=/usr/sbin/openvpn --daemon ovpn-%i --status /run/openvpn/%i.status 10 --cd /etc/ope
 Main PID: 1999 (openvpn)
   CGroup: /system.slice/system-openvpn.slice/openvpn@server.service
           └─1999 /usr/sbin/openvpn --daemon ovpn-server --status /run/openvpn/server.status 10 --cd /etc/ope

May 18 11:57:03 <server> systemd[1]: Starting OpenVPN connection to server...
May 18 11:57:04 <server> systemd[1]: Started OpenVPN connection to server.
```

If everything is OK, enable the OpenVPN service so that it can start automatically when the OS reboots.

```bash
sudo systemctl enable openvpn@server
```

## Step 7: Generate Client Profile and Connect to OpenVPN Service

Create a shell script to generate the client profile.

```bash
vi genprofile.sh
```

Add the following lines to genprofile.sh.

```bash
cd ~/openvpn-ca
source vars
./build-key --batch $1
cd ~/client-configs
./make_config.sh $1
```

Press "ESC", type ":wq" to save the file

```bash
chmod +x genprofile.sh
```

Create a new directory called "client-configs"

```bash
mkdir client-configs
mkdir client-configs/files
cd client-configs
```

Create a base client configuration file "base.conf"

```bash
vi base.conf
```

Add the following lines to it.

```bash
client
dev tun
proto udp
remote <YOUR_OPENVPN_PUBLIC_IP_OR_DNS_NAME> 32768
resolv-retry infinite
nobind
user nobody
group nogroup
persist-key
persist-tun
remote-cert-tls server
key-direction 1
cipher AES-256-CBC
auth SHA512
comp-lzo
verb 3
```

ESC, type ":wq" to save the file. Now create a script file called make\_config.sh

```bash
vi make_config.sh
```

Add following content into the file

```bash
#!/bin/bash

# First argument: Client identifier

KEY_DIR=~/openvpn-ca/keys
OUTPUT_DIR=~/client-configs/files
BASE_CONFIG=~/client-configs/base.conf

cat ${BASE_CONFIG} \
    <(echo -e '<ca>') \
    ${KEY_DIR}/ca.crt \
    <(echo -e '</ca>\n<cert>') \
    ${KEY_DIR}/${1}.crt \
    <(echo -e '</cert>\n<key>') \
    ${KEY_DIR}/${1}.key \
    <(echo -e '</key>\n<tls-auth>') \
    ${KEY_DIR}/ta.key \
    <(echo -e '</tls-auth>') \
    > ${OUTPUT_DIR}/${1}.ovpn
```

ESC, type ":wq" to save the file

```bash
chmod +x make_config.sh
```

## Step 8: Connect to OpenVPN server from client side

From OpenVPN server, run

```bash
./genprofile.sh <profile name>
```

The command above will generate a client profile and save it into ~/client-configs/files. Copy/download this profile to the client side, then import this profile from OpenVPN and connect.

The client should have an OpenVPN connection established, and it should redirect all traffic to OpenVPN now.
