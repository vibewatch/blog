---
title: "Create SSH VPN over PPP"
slug: "create-ssh-vpn-over-ppp"
date: "2021-09-30 02:54:59"
updated: "2022-11-11 01:18:12"
type: "post"
status: "published"
visibility: "public"
featured: false
excerpt: ""
feature_image: ""
authors: ["Yingting Huang"]
tags: []
---
# Create SSH VPN over PPP

This example runs PPP over an SSH connection. Install `ppp` on both hosts and configure key-based SSH access to the remote host before starting the service. Replace the remote IP address with your own.

Create `/etc/systemd/system/pppd.service` with the following content:

```ini
[Unit]
Description=PPP over SSH
After=network.target

[Service]
ExecStart=/usr/sbin/pppd nodetach noauth silent nodeflate pty "/usr/bin/ssh root@<your_remote_server_ip> /usr/sbin/pppd nodetach notty noauth" ipparam vpn 172.18.8.1:172.18.8.2
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Reload systemd's unit definitions, then enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pppd
```
