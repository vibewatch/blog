---
title: "Cheap Visual Studio Code(VSCode) Online Solution"
slug: "cheap-visual-studio-code-vscode-online-solution"
date: "2019-11-05 03:36:31"
updated: "2019-11-05 06:21:18"
type: "post"
status: "published"
visibility: "public"
featured: true
excerpt: "Cheap Visual Studio Code(VSCode) Online Solution"
feature_image: ""
authors: ["Yingting Huang"]
tags: ["VSCode", "Debugging", "Kubernetes"]
---
# Cheap Visual Studio Code(VSCode) Online Solution

Microsoft just released [Visual Studio Code Online](https://visualstudio.microsoft.com/services/visual-studio-online/) preview.

When using it for full-time development, [Visual Studio Online pricing](https://azure.microsoft.com/en-us/pricing/details/visual-studio-online/) will cost about ~$50/month. If you are looking for a much cheaper alternative with similar functionality to VSCode online, you can use [code-server](https://github.com/cdr/code-server) and host a similar online service in your own cloud.

For example, I hosted code-server in my own Kubernetes cluster deployed in Azure. I use a B2S VM, which only costs about ~$30/month. P.S. the same VM also runs other workloads, so it is much cheaper than the official preview of VSCode online. I built a Docker image that includes Golang, gcc/g++, .NET Core, Python, Node.js, and Lua support. When using the service, you get online editing and debugging support, which is pretty fancy to me.

I published the Dockerfile and Kubernetes deployment files in my [repository](https://github.com/huangyingting/devops/tree/master/code-server).

1.  The Dockerfile contains the necessary steps to build the image. To build it, you can run "docker build -t huangyingting/code ." and "docker push huangyingting/code" to push it to Docker Hub. You can also customize it and add software you'd like to use in the Dockerfile.
2.  `code-server.yaml` is the Kubernetes deployment file. I use oauth2\_proxy to restrict who can access the ingress service. To configure oauth2\_proxy, please refer to my previous [post](/protect-kubernetes-webapps-with-azure-active-directory-aad-authentication/), then run "kubectl apply -f code-server.yaml".

I also captured some screenshots to demonstrate what you can do from the online service.

1.  Online editing of big git repository  
    ![Linux-VSCode](/assets/posts/cheap-visual-studio-code-vscode-online-solution/linux-vscode.jpg)
2.  Debugging python code![Python-Debug-VSCode](/assets/posts/cheap-visual-studio-code-vscode-online-solution/python-debug-vscode.jpg)
