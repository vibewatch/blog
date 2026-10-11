---
title: "Ubuntu: Generate a Core Dump"
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
# Ubuntu: Generate a Core Dump

This example generates a core dump when a test process aborts; it does not capture a running process. Run the configuration commands with root privileges and start a new login session after changing `/etc/security/limits.conf`.

systemctl disable apport.service

/etc/security/limits.conf

\* soft core unlimited  
\* hard core unlimited

/etc/sysctl.conf  
kernel.core\_pattern=/cores/core.%e.%p.%h.%t  
mkdir /cores  
chmod a+rwx /cores

sysctl -p

Save the following test program as `t.c`:

```c
#include <stdlib.h>

int main() {
    abort();
}
```

```bash
gcc -o t t.c
./t
```

A core dump will be generated in `/cores` if core dumps are enabled for the process, for example:

core.t.1219.u01.1570927314
