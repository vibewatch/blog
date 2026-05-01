---
title: "Ubuntu Generate Core Dump On Fly"
slug: "ubuntu-generate-core-dump-on-fly"
date: "2019-10-13 00:42:30"
updated: "2019-10-15 05:28:32"
type: "post"
status: "published"
visibility: "public"
featured: false
excerpt: ""
feature_image: "/assets/posts/ubuntu-generate-core-dump-on-fly/hero.jpg"
authors: ["Yingting Huang"]
tags: ["Linux", "Coredump"]
---
systemctl disable apport.service

/etc/security/limits.conf

\* soft core unlimited  
\* hard core unlimited

/etc/sysctl.conf  
kernel.core\_pattern=/cores/core.%e.%p.%h.%t  
mkdir /cores  
chmod a+rwx /cores

sysctl -p

```cpp
int main() {
    int *p;
    return *p;
}
```

gcc -o t t.c  
.\\t

Coredump will be generated at /cores  
core.t.1219.u01.1570927314
