---
title: "How to Setup an OpenVPN Server on Azure (Updated)"
slug: "how-to-setup-an-openvpn-server-on-azure-updated"
date: "2023-01-15 08:57:03"
updated: "2023-07-16 04:00:29"
type: "post"
status: "published"
visibility: "public"
featured: false
excerpt: ""
feature_image: "https://images.unsplash.com/photo-1603985529862-9e12198c9a60?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwxMTc3M3wwfDF8c2VhcmNofDJ8fHZwbnxlbnwwfHx8fDE2NzM3NzMwMDA&ixlib=rb-4.0.3&q=80&w=2000"
authors: ["Yingting Huang"]
tags: ["Linux", "OpenVPN", "Azure"]
---
This is an updated version for my previous article [How to Setup an OpenVPN Server on Azure](/how-to-setup-an-openvpn-server-on-azure/) to support configure OpenVPN on Ubuntu 22.04 since a lot of changes happened on Easy-RSA.

## **Prerequisites**

*   Ubuntu 22.04 VM deployed in Azure at least with one NIC which has public IP address enabled.
*   User with sudo privilege on Ubuntu 22.04 VM.
*   VM private IP address doesn't overlap with subnet 172.16.0.0/24
*   NSG rule is added to VM to allow UDP destination port 32768

## **Install OpenVPN & Easy-RSA**

```bash
# install openvpn & easy-rsa
sudo apt update
sudo apt install openvpn easy-rsa net-tools

# configure easy-rsa
make-cadir ~/openvpn-ca
```

Configure `vars` file to include configurations

```bash
cd ~/openvpn-ca
vi vars
```

set\_var EASYRSA\_REQ\_COUNTRY "SG"  
set\_var EASYRSA\_REQ\_PROVINCE "Singapore"  
set\_var EASYRSA\_REQ\_CITY "Singapore"  
set\_var EASYRSA\_REQ\_ORG "Your Org"  
set\_var EASYRSA\_REQ\_EMAIL "admin@example.com"  
set\_var EASYRSA\_REQ\_OU  "Your OU"  
set\_var EASYRSA\_KEY\_SIZE 2048  
set\_var EASYRSA\_CA\_EXPIRE 36500  
set\_var EASYRSA\_CERT\_EXPIRE 3650  
set\_var EASYRSA\_REQ\_CN  "OpenVPN-CA"  
set\_var EASYRSA\_BATCH  "1"

## **Setup CA & Configure OpenVPN**

Setup CA

```bash
export EASYRSA_BATCH=1
./easyrsa init-pki
./easyrsa build-ca nopass
```

When bash asks "Common Name", enter "OpenVPN-CA", then execute below commands to generate server certificate

```bash
./easyrsa gen-req ovpn nopass
./easyrsa sign-req server ovpn
./easyrsa gen-dh
openvpn --genkey secret pki/ta.key
```

Move certificates and keys to OpenVPN etc directory and create a user represents openvpn

```bash
sudo cp pki/ca.crt pki/ta.key pki/dh.pem pki/issued/ovpn.crt pki/private/ovpn.key /etc/openvpn/server
sudo adduser --system --shell /usr/sbin/nologin --no-create-home openvpn
```

Configure OpenVPN

```bash
sudo vi /etc/openvpn/server/server.conf
```

```bash
# OpenVPN listening address
local 10.0.0.4
# OpenVPN listening port
port 32768
# tcp/udp
proto udp
dev tun
ca ca.crt
cert ovpn.crt
key ovpn.key
dh dh.pem
# OpenVPN network
server 172.16.0.0 255.255.255.0
ifconfig-pool-persist ipp.txt
# Redirect all traffics to OpenVPN
push "redirect-gateway def1 bypass-dhcp"
push "dhcp-option DNS 8.8.8.8"
push "dhcp-option DNS 8.8.8.4"
keepalive 10 120
# This file is secret
tls-auth ta.key 0
# Cipher settings
cipher AES-256-GCM
auth SHA512
tls-cipher TLS-DHE-RSA-WITH-AES-256-GCM-SHA384:TLS-DHE-RSA-WITH-AES-128-GCM-SHA256:TLS-DHE-RSA-WITH-AES-256-CBC-SHA:TLS-DHE-RSA-WITH-CAMELLIA-256-CBC-SHA:TLS-DHE-RSA-WITH-AES-128-CBC-SHA:TLS-DHE-RSA-WITH-CAMELLIA-128-CBC-SHA
comp-lzo
user openvpn
group nogroup
persist-key
persist-tun
log /var/log/openvpn/server.log
log-append server.log
verb 4
```

Adding iptables rules to NAT OpenVPN traffic

```bash
# iptables configuration for openvpn
sudo iptables -A INPUT -i eth0 -p udp -m state --state NEW -m udp --dport 32768 -j ACCEPT
sudo iptables -A INPUT -i tun+ -j ACCEPT
sudo iptables -A FORWARD -i tun+ -j ACCEPT
sudo iptables -A OUTPUT -o tun+ -j ACCEPT
sudo iptables -A FORWARD -i tun+ -o eth0 -m state --state RELATED,ESTABLISHED -j ACCEPT
sudo iptables -A FORWARD -i eth0 -o tun+ -m state --state RELATED,ESTABLISHED -j ACCEPT
sudo iptables -t nat -A POSTROUTING -s 172.16.0.0/24 -o eth0 -j MASQUERADE
```

```bash
sudo bash -c "echo 'net.ipv4.ip_forward = 1' >> /etc/sysctl.conf"
sudo sysctl -p
```

Use iptables-persistent to save iptables rules

```bash
sudo apt install iptables-persistent
```

Start & Enable OpenVPN server service

```bash
sudo systemctl start openvpn-server@server
sudo systemctl status openvpn-server@server
sudo systemctl enable openvpn-server@server
```

## **Generate Client Profile and Connect to OpenVPN Service**

Create a shell script to generate client profile

```bash
cd ~
vi genprofile.sh
```

Add following lines into genprofile.sh

```bash
#!/bin/bash
export EASYRSA_BATCH=1
cd ~/openvpn-ca
./easyrsa gen-req $1 nopass
./easyrsa sign-req client $1
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

Add following lines

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
cipher AES-256-GCM
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

KEY_DIR=~/openvpn-ca/pki
OUTPUT_DIR=~/client-configs/files
BASE_CONFIG=~/client-configs/base.conf

cat ${BASE_CONFIG} \
    <(echo -e '<ca>') \
    ${KEY_DIR}/ca.crt \
    <(echo -e '</ca>\n<cert>') \
    ${KEY_DIR}/issued/${1}.crt \
    <(echo -e '</cert>\n<key>') \
    ${KEY_DIR}/private/${1}.key \
    <(echo -e '</key>\n<tls-auth>') \
    ${KEY_DIR}/ta.key \
    <(echo -e '</tls-auth>') \
    > ${OUTPUT_DIR}/${1}.ovpn
```

ESC, type ":wq" to save the file

```bash
chmod +x make_config.sh
```

## Connect to OpenVPN server from client side

From OpenVPN server, run

```bash
./genprofile.sh <profile name>
```

Above command will generate a client profile and save it into ~/client-configs/files, copy/download this profile to client side, from OpenVPN, import this profile and connect.

The client should have OpenVPN connection established and it should redirect all traffics to OpenVPN now.

## Use Cloud Provider's Network to Accelerate OpenVPN Connection

If you happen to use a cloud provider and your OpenVPN client is close to one of cloud provider's regions, you could use your cloud provider's network to bridge VPN connection between OpenVPN client and OpenVPN server, the benefits are

*   Reliable VPN connectivity, cloud provider usually provides dedicated internet link cross border
*   Leverage cloud provider's global network to accelerate VPN connectvity, some cloud providers provides [hot potato routing](https://en.wikipedia.org/wiki/Hot-potato_and_cold-potato_routing) by default, for example Azure or GCP, that means VPN traffic usually goes into optimal paths
*   Even you are using sovereign cloud, internet quality between your sovereign cloud provider and VPN server, is still better than your home network

Here is a simple solution that use iptables to bounce traffic from your local cloud data center to remote VPN server

*   In order to bounce traffic, you should have a Linux VM instance running from your cloud provider's local data center, for example a Ubuntu server distribution with 1 CPU and 1GB memory should be enough
*   Mapping a UDP port from your Linux VM instance to remote OpenVPN server's port, open NSG to allow that UDP port from your Linux instance. For example, OpenVPN server's UDP port is 1194, you can map a random UDP port say 11940 from your Linux VM instance to 1194 and open NSG to allow 11940 UDP traffic to pass to your Linux VM instance
*   Add two iptables rules from your Linux VM instance

```bash
iptables -A PREROUTING -p udp -m udp --dport <Mapped UDP Port> -j DNAT --to-destination <Remote OpenVPN IP>:<Remote OpenVPN Port>
iptables -A POSTROUTING -d <Remote OpenVPN IP>/32 -p udp -m udp --dport <Remote OpenVPN Port> -j SNAT --to-source <Linux VM's IP, usually from eth0>
```
