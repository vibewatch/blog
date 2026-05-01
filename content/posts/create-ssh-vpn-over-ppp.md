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
feature_image: "https://images.unsplash.com/photo-1564146705498-1edeb0044d80?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwxMTc3M3wwfDF8c2VhcmNofDl8fHZwbnxlbnwwfHx8fDE2NjgxMjk0Njg&ixlib=rb-4.0.3&q=80&w=2000"
authors: ["Yingting Huang"]
tags: []
---
sudo vi /lib/systemd/system/pppd.service

\[Unit\]  
Description=PPP over Serial link  
After=network.target

\[Service\]  
ExecStart=/usr/sbin/pppd nodetach noauth silent nodeflate pty "/usr/bin/ssh root@<your\_remote\_server\_ip> /usr/sbin/pppd nodetach notty noauth" ipparam vpn 172.18.8.1:172.18.8.2  
Restart=on-failure

\[Install\]  
WantedBy=multi-user.target

sudo systemctl reload pppd
