---
title: "Cost-Effective Private Large Language Model Inference on Azure Kubernetes Service"
slug: "cost-effective-private-large-language-model-inference-on-azure-kubernetes-service"
date: "2023-08-22 03:51:36"
updated: "2023-08-24 12:03:11"
type: "post"
status: "published"
visibility: "public"
featured: true
excerpt: ""
feature_image: "/assets/posts/cost-effective-private-large-language-model-inference-on-azure-kubernetes-service/hero.jpg"
authors: ["Yingting Huang"]
tags: []
---
# Cost-Effective Private Large Language Model Inference on Azure Kubernetes Service

## Introduction

This article provides a method for private and cost-optimized deployment of large language models on the Azure cloud. It assumes the reader has foundational knowledge of large language models and Kubernetes.

It utilizes AKS spot instances, quantization techniques, and batch inference to reduce compute costs compared to traditional deployment approaches.

A [proof-of-concept deployment](https://github.com/huangyingting/llm-inference) demonstrates using cluster autoscaler, GPU node pools, pod affinity, and tolerations on Azure Kubernetes Service to enable fast and resilient large language model inference with low-cost spot instance GPU nodes.

### Reasons for running large language models privately

There are several motivations for organizations to run large language models privately:

*   Customization - Private models can be customized for specific domains by providing proprietary training data. This improves accuracy for niche tasks like internal search or customer support.
*   Confidentiality - Keeping data internal allows tighter control over sensitive information like personal data, intellectual property, or competitive intelligence.
*   Control - Full control over the training data, hyperparameters, model architecture, etc. This allows you to ensure the model behaves as intended.
*   Low latency - A privately hosted model can provide very low latency responses since you don't have to make API calls over the internet to external servers.
*   Compliance - For regulated industries like healthcare and finance, running a private model may be important for compliance with data protection and privacy regulations.

### Challenges of running inference cost-effectively and efficiently

Deploying large language models for inference is compute-intensive, requiring high-end GPUs and specialized hardware that can be very expensive to provision on cloud platforms. For example, an 80GB Nvidia A100 GPU on Azure can generate approximately 60 completion tokens per second when running a 13 billion parameter model like Vicuna. If we calculate the monthly cost of running just a single A100 virtual machine in Azure's East US region, it comes out to $2,680. This one GPU could generate around 157 million tokens per month.

In contrast, at the historical rate of $0.0015 per 1,000 tokens used in this comparison, 157 million tokens would cost about $235.50. Actual Azure OpenAI costs depend on the model, separate input/output rates, and current pricing; this is an illustrative calculation, not a current quote. Additionally, ChatGPT provides a smoother conversational experience compared to a basic 13B parameter model.

Beyond raw compute costs, the development, infrastructure, and maintenance required to build and deploy production-grade private language models at scale poses further operational challenges.

## Proof-of-concept architecture

This proof-of-concept leverages Azure Kubernetes Service (AKS), quantization, and batch inference to enable a cost-optimized private deployment of large language models while maintaining scalability and fault tolerance.  
Key techniques:

*   AKS enables the use of spot instances and GPUs through configurable node pools. Spot instances significantly reduce compute costs compared to on-demand instance pricing. To handle potential node evictions, the AKS cluster autoscaler component monitors pod resource requirements and calculates the capacity needed for scheduled GPU workloads. It then automatically adjusts node counts to match workload demands. If each of two replicas has an independent 5% probability of eviction over the same interval, the probability that at least one remains is `1 - 0.05² = 99.75%`. This simplified calculation is not an availability guarantee: evictions can be correlated, and replacement GPU capacity may be unavailable.
*   Quantization reduces the memory required by large language models by representing weights, and sometimes activations, at lower numeric precision. It can also accelerate inference when supported by the hardware and runtime, though accuracy and speed must be measured for the chosen model. [GGML](https://github.com/ggerganov/ggml) supports quantized inference, while [GPTQ](https://arxiv.org/abs/2210.17323) is a weight-quantization method.
*   Batching groups multiple inference requests into a single batch call instead of handling them individually. This improves utilization for sporadic workloads. Batching is particularly beneficial for compute-intensive LLMs that can take several seconds per request. [vLLM](https://github.com/vllm-project/vllm) and [text-generation-inference](https://github.com/huggingface/text-generation-inference) are two common batch inference frameworks for LLMs. In the next section, we will leverage vLLM to demonstrate the advantages of batching in our proof-of-concept deployment.

![Architecture Design](https://raw.githubusercontent.com/huangyingting/llm-inference/main/docs/images/LLM-AKS.svg)

By integrating these optimization methods, higher throughput and lower costs can be achieved. Measure model quality and request latency as well: quantization can affect accuracy, and batching can trade latency for throughput.

## Proof-of-concept deployment and considerations

Before starting, ensure you have the following prerequisites:

*   An existing AKS cluster. If you need to create one, you can use the [Azure CLI](https://learn.microsoft.com/en-us/azure/aks/learn/quick-kubernetes-deploy-cli), [Azure PowerShell](https://learn.microsoft.com/en-us/azure/aks/learn/quick-kubernetes-deploy-powershell), or the [Azure portal](https://learn.microsoft.com/en-us/azure/aks/learn/quick-kubernetes-deploy-portal).
*   The `aks-preview` extension installed and the `GPUDedicatedVHDPreview` feature registered. Follow these [instructions](https://docs.microsoft.com/en-us/azure/aks/gpu-cluster#enable-the-gpu-dedicated-vhd-preview-feature) to set them up.
*   A container image for LLM inference. For this PoC, we will use [vLLM](https://github.com/vllm-project/vllm) and the image `ghcr.io/huangyingting/llm-inference-vllm:main`, built from [this Dockerfile](https://github.com/huangyingting/llm-inference/blob/main/vllm/Dockerfile).

**NOTE**: For production use, it is recommended to build your own custom image. This provides full control over dependencies and compatibility between the GPU accelerated application and GPU driver on the nodes. Refer to the [CUDA Compatibility and Upgrades](https://docs.nvidia.com/deploy/cuda-compatibility/index.html).

### Define environment variables

We first need to define the following environment variables to configure the GPU spot node pool. The values for these variables can be obtained from the Azure portal or using the Azure CLI:

```shell
# AKS cluster info
export RESOURCE_GROUP_NAME=your_aks_resource_group_name
export CLUSTER_NAME=your_aks_cluster_name
export REGION=your_aks_cluster_region
# GPU VM size, use Standard_NC4as_T4_v3 for PoC purpose
export VM_SIZE=Standard_NC4as_T4_v3
```

### Add a GPU spot node pool

Now we can add a spot node pool for GPU nodes to an existing AKS cluster. The following command creates a new node pool named `gpunp` with one node of size `Standard_NC4as_T4_v3`. The node pool will be configured with GPU taints and cluster autoscaler. The GPU taints restrict scheduling to pods with matching tolerations. The cluster autoscaler automatically adjusts the number of nodes in the node pool based on workload demands. The node pool will also be configured with spot instances to reduce compute costs. Setting spot-max-price to -1 avoids price-based eviction, but capacity-based eviction is still possible. The min-count is 1 and max-count is 2, allowing the autoscaler to request a second node for the two-replica deployment; neither setting guarantees spot capacity.

```shell
az aks nodepool add \
    --resource-group $RESOURCE_GROUP_NAME \
    --cluster-name $CLUSTER_NAME \
    --name gpunp \
    --node-count 1 \
    --node-vm-size $VM_SIZE \
    --node-taints sku=gpu:NoSchedule \
    --aks-custom-headers UseGPUDedicatedVHD=true \
    --enable-cluster-autoscaler \
    --priority Spot \
    --eviction-policy Delete \
    --spot-max-price -1 \
    --min-count 1 \
    --max-count 2
```

### Deploy LLM inference service

With the AKS GPU node pool provisioned, we can now deploy the LLM inference service. Using vLLM as an example, the deployment manifests are located [here](https://github.com/huangyingting/llm-inference/tree/main/vllm/manifests/). There are two manifest options, each using a different storage backend for storing the model files:

The `vllm-azure-disk.yaml` manifest deploys a `StatefulSet` with 2 replicas and a Service for the LLM inference service. The StatefulSet is configured with pod anti-affinity to ensure the replicas are scheduled on different nodes. It also has tolerations to schedule the replicas on the GPU spot node pool. The Service exposes the LLM inference service on the AKS cluster using a ClusterIP. Each StatefulSet replica mounts a 16GB Azure Disk PersistentVolumeClaim for storing the model files.

The `vllm-azure-files.yaml` manifest deploys a `Deployment` with 2 replicas and a Service for the LLM inference service. The Deployment has pod anti-affinity to schedule replicas on different nodes. It also has tolerations to schedule replicas on the GPU spot node pool. The Service exposes the inference service on the AKS cluster using a ClusterIP. Each replica mounts a 16GB Azure File share PersistentVolumeClaim for storing model files, with the PV shared between replicas.

AKS supports shared disks using block volumes. However, multi-node read/write is not supported on common filesystems like ext4 or xfs - only cluster filesystems allow this. Therefore, shared disks cannot be used for storing model files that need to be accessed from multiple nodes.

GPU spot nodes in this example have the taints `nvidia.com/gpu:NoSchedule`, `sku=gpu:NoSchedule`, and `kubernetes.azure.com/scalesetpriority=spot:NoSchedule`. To schedule GPU workloads on these nodes, add matching tolerations to the pod specification in each manifest. Create the namespace first:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: llm
```

Apply this namespace definition before deploying the manifests. Namespace annotations do not automatically add tolerations in a standard AKS cluster; the legacy `defaultTolerations` annotation requires a specific admission controller. Keep tolerations in the pod templates and request the GPU resources the model needs.

To begin the deployment by using `StatefulSet`, execute this command:

```shell
kubectl apply -f vllm/manifests/vllm-azure-disk.yaml
```

To begin the deployment by using `Deployment`, execute this command:

```shell
kubectl apply -f vllm/manifests/vllm-azure-files.yaml
```

**NOTE**: The manifests are configured to use the image `ghcr.io/huangyingting/llm-inference-vllm:main`, you can change it to your own image.

### AKS cluster autoscaler

We deployed two replicas but initially there was only 1 GPU node. The cluster autoscaler detected the insufficient resources and scaled the node pool up to 2 nodes. The status of the autoscaler can be checked by running this command:

```shell
kubectl describe pod vllm-1 -n llm

Name:             vllm-1
Namespace:        llm
Priority:         0
...
Node-Selectors:              <none>
Tolerations:                 kubernetes.azure.com/scalesetpriority=spot:NoSchedule
                             node.kubernetes.io/not-ready:NoExecute op=Exists for 300s
                             node.kubernetes.io/unreachable:NoExecute op=Exists for 300s
                             nvidia.com/gpu:NoSchedule op=Exists
                             sku=gpu:NoSchedule
Events:
  Type     Reason                  Age                    From                     Message
  ----     ------                  ----                   ----                     -------
  Normal   NotTriggerScaleUp       6m42s                  cluster-autoscaler       pod didn't trigger scale-up: 2 max node group size reached
  Normal   TriggeredScaleUp        3m5s                   cluster-autoscaler       pod triggered scale-up: [{aks-gpunp-98036146-vmss 1->2 (max: 2)}]
  Warning  FailedScheduling        2m12s (x2 over 7m14s)  default-scheduler        0/2 nodes are available: 2 Insufficient nvidia.com/gpu. preemption: 0/2 nodes are available: 2 No preemption victims found for incoming pod..
  Warning  FailedScheduling        34s                    default-scheduler        0/3 nodes are available: 1 node(s) had untolerated taint {node.kubernetes.io/network-unavailable: }, 2 Insufficient nvidia.com/gpu. preemption: 0/3 nodes are available: 1 Preemption is not helpful for scheduling, 2 No preemption victims found for incoming pod..
  Normal   Scheduled               19s                    default-scheduler        Successfully assigned llm/vllm-1 to aks-gpunp-98036146-vmss000004
  Normal   SuccessfulAttachVolume  9s                     attachdetach-controller  AttachVolume.Attach succeeded for volume "pvc-d3ccf681-99ae-411a-8d72-33063bf9e422"
  Normal   Pulling                 4s                     kubelet                  Pulling image "ghcr.io/huangyingting/llm-inference-vllm:main"
```

We can simulate a spot-node eviction to test the recovery behavior. Retrieve the cluster's node resource group and list its scale sets, then replace `<VMSS_NAME>` with the GPU spot pool's scale set name. Recovery still depends on replacement capacity being available.

```shell
NODE_RESOURCE_GROUP=$(az aks show --resource-group "$RESOURCE_GROUP_NAME" --name "$CLUSTER_NAME" --query nodeResourceGroup --output tsv)
az vmss list --resource-group "$NODE_RESOURCE_GROUP" --query "[].name" --output tsv
az vmss simulate-eviction --resource-group "$NODE_RESOURCE_GROUP" --name "<VMSS_NAME>" --instance-id 0
```

### Test LLM inference

The deployment comes with a default model, `lmsys/vicuna-7b-v1.5`, and an OpenAI API-compatible endpoint. We can test the inference service by running the following command:

```shell
# port forwarding to the service
kubectl port-forward svc/vllm 9090:8080 -n llm
```

```shell
curl http://localhost:8192/v1/chat/completions -H "Content-Type: application/json" -d '{
     "model": "lmsys/vicuna-7b-v1.5",
     "max_tokens": 1024,
     "messages": [{"role": "user", "content": "What is large language model?"}],
     "temperature": 0.9 
   }'
```

## Wrap-up

In summary, this article has outlined an approach to deploy large language models on Azure Kubernetes Service in a cost-optimized and scalable manner for private inference. By combining cloud-native techniques like spot instances and autoscaling with model optimization methods like quantization and batching, organizations can unlock the advanced AI capabilities of large models while maintaining control, low latency, and reduced costs compared to public services.
