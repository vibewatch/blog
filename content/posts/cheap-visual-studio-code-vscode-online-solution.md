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
feature_image: "https://images.unsplash.com/photo-1570215170761-f056128eda48?ixlib=rb-1.2.1&q=80&fm=jpg&crop=entropy&cs=tinysrgb&w=1080&fit=max&ixid=eyJhcHBfaWQiOjExNzczfQ"
authors: ["Yingting Huang"]
tags: ["VSCode", "Debugging", "Kubernetes"]
---
Microsoft just released [Visual Studio Code Online](https://visualstudio.microsoft.com/services/visual-studio-online/) preview.

When use it for full time development, [Visual Studio Online pricing](https://azure.microsoft.com/en-us/pricing/details/visual-studio-online/) will charge about ~50$/month, if you are looking for an alternative much cheaper solution while has similar functionality of VSCode online, you can actually use [code-server](https://github.com/cdr/code-server) and host similar online service in your own cloud.

For example, I hosted code-server in my own kubernetes cluster deployed in Azure, I use B2S VM which only charge me for ~30$/Month, P.S, same VM also runs other worloads, so it is much cheaper than offical preview VSCode online. I built a docker image which contains golang, gcc/g++, dotnet core, python, nodejs and lua support, when use the service, you could have editing & debugging support online, which is pretty fancy for me.

I published Dockerfile and kubernetes deployment files in my [repository](https://github.com/huangyingting/devops/tree/master/code-server)

1.  Dockerfile contains necessary steps to build the image, to build it, you can run "docker build -t huangyingting/code ." and "docker push huangyingting/code" to dockerhub. You can also customize it and add software you'd like to use in dockerfile.
2.  code-server.yaml is the kubernetes deployment file, I use oauth2\_proxy to restrict who can access the ingress service, to configure oauth2\_proxy, please refer to my previous [post](/protect-kubernetes-webapps-with-azure-active-directory-aad-authentication/), then run "kubectl apply -f code-server.yaml"

I also captured some screen shots to demo what you can do from the online service

1.  Online editing of big git repository  
    ![Linux-VSCode](/assets/posts/cheap-visual-studio-code-vscode-online-solution/linux-vscode.jpg)
2.  Debugging python code![Python-Debug-VSCode](/assets/posts/cheap-visual-studio-code-vscode-online-solution/python-debug-vscode.jpg)
