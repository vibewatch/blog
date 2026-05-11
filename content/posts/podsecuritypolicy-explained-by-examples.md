---
title: "Pod Security Policy Explained by Examples"
slug: "podsecuritypolicy-explained-by-examples"
date: "2019-01-15 07:08:00"
updated: "2019-01-15 09:02:46"
type: "post"
status: "published"
visibility: "public"
featured: true
excerpt: "Pod security policy enables fine-grained authorization of pod creation and updates, but it also has some mysterious behavior. This article gives more insight into how it works."
feature_image: "/assets/posts/podsecuritypolicy-explained-by-examples/hero.jpg"
authors: ["Yingting Huang"]
tags: ["Kubernetes", "K8S", "PodSecurityPolicy"]
---
> **Note (May 2026):** PodSecurityPolicy was deprecated in Kubernetes 1.21 and removed in Kubernetes 1.25. This article is useful for understanding historical PSP behavior, but new clusters should use Pod Security Admission, ValidatingAdmissionPolicy, OPA Gatekeeper, Kyverno, or another current policy mechanism instead.

# 1 What Is Pod Security Policy?

> A Pod Security Policy is a cluster-level resource that controls security sensitive aspects of the pod specification. The PodSecurityPolicy objects define a set of conditions that a pod must run with in order to be accepted into the system, as well as defaults for the related fields.

# 2 How to Enable the Pod Security Policy Admission Controller

> PodSecurityPolicies are enforced by enabling the admission controller

It can be enabled by adding `--enable-admission-plugins=PodSecurityPolicy,...` to the kube-apiserver configuration file, for example /etc/kubernetes/manifest/kube-apiserver.yaml.

# 3 What Happens After Enabling the Pod Security Policy Admission Controller

> but doing so without authorizing any policies will prevent any pods from being created in the cluster.

That means if PodSecurityPolicy is enabled but no policies are defined, creating any Pods in the Kubernetes cluster will be blocked.

For example, in a Kubernetes cluster without any PodSecurityPolicy defined:

```bash
kubectl get psp
No resources found.
```

Try to deploy a Pod with the definition below.

```yaml
# pd.yaml
apiVersion: v1
kind: Pod
metadata:
  name: pd
spec:
  containers:
    - name: pause
      image: k8s.gcr.io/pause
      securityContext:
        privileged: true
```

With command `kubectl apply -f pd.yaml`, it will report the error below.

```bash
Error from server (Forbidden): error when creating "pd.yaml": pods "pd" is forbidden: no providers available to validate pod request
```

# 4 How to Add Pod Security Policies

We will create two pod security policies here and use them for further explanations. 100-psp.yaml is a restricted policy, and 200-psp.yaml is a privileged policy.

For more information about how to define a pod security policy, refer to [Create a policy and a pod](https://kubernetes.io/docs/concepts/policy/pod-security-policy/#create-a-policy-and-a-pod).

100-psp.yaml

```yaml
# 100-psp.yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  annotations:
    apparmor.security.beta.kubernetes.io/allowedProfileNames: 'runtime/default'
    apparmor.security.beta.kubernetes.io/defaultProfileName:  'runtime/default'
    seccomp.security.alpha.kubernetes.io/allowedProfileNames: 'docker/default'
    seccomp.security.alpha.kubernetes.io/defaultProfileName:  'docker/default'
  name: 100-psp
spec:
  # default set of capabilities are implicitly allowed
  allowedCapabilities: []
  allowPrivilegeEscalation: false
  fsGroup:
    rule: 'MustRunAs'
    ranges:
      # Forbid adding the root group.
      - min: 1
        max: 65535
  hostIPC: false
  hostNetwork: false
  hostPID: false
  privileged: false
  readOnlyRootFilesystem: false
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  supplementalGroups:
    rule: 'MustRunAs'
    ranges:
      # Forbid adding the root group.
      - min: 1
        max: 65535
  volumes:
  - 'configMap'
  - 'downwardAPI'
  - 'emptyDir'
  - 'persistentVolumeClaim'
  - 'projected'
  - 'secret'
  hostPorts:
  - min: 0
    max: 0
```

200-psp.yaml

```yaml
# 200-psp.yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  annotations:
    apparmor.security.beta.kubernetes.io/allowedProfileNames: 'runtime/default'
    apparmor.security.beta.kubernetes.io/defaultProfileName:  'runtime/default'
    seccomp.security.alpha.kubernetes.io/allowedProfileNames: 'docker/default'
    seccomp.security.alpha.kubernetes.io/defaultProfileName:  'docker/default'
  name: 200-psp
spec:
  allowedCapabilities:
  - '*'
  allowPrivilegeEscalation: true
  fsGroup:
    rule: 'RunAsAny'
  hostIPC: true
  hostNetwork: true
  hostPID: true
  hostPorts:
  - min: 0
    max: 65535
  privileged: false
  readOnlyRootFilesystem: false
  runAsUser:
    rule: 'RunAsAny'
  seLinux:
    rule: 'RunAsAny'
  supplementalGroups:
    rule: 'RunAsAny'
  volumes:
  - '*'
```

## 4.1 Apply the Policies

Run `kubectl apply -f 100-psp.yaml` and `kubectl apply -f 200-psp.yaml`. The two pod security policies above will be added to the system.

# 5 Will the Newly Created Policies Be Enforced Now?

The answer can be either 'Yes' or 'No', refer to [Authorizing Policies](https://kubernetes.io/docs/concepts/policy/pod-security-policy/#authorizing-policies)

> When a PodSecurityPolicy resource is created, it does nothing. In order to use it, the requesting user or target pod’s service account must be authorized to use the policy, by allowing the use verb on the policy.

Basically, it means that in order to enforce a policy, we need to create a (Cluster)Role that grants access to the pod security policy, then bind this (Cluster)Role to certain users or service accounts. When those users or service accounts try to create a Pod, they will be validated by that pod security policy.

For example, we can define a simple YAML file to bind the 100-psp policy to the system:authenticated group, so all authenticated users/service accounts will be enforced/validated by the 100-psp policy.

```yaml
# Cluster role which grants access to the default pod security policy
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: 100-psp
rules:
- apiGroups:
  - policy
  resourceNames:
  - 100-psp
  resources:
  - podsecuritypolicies
  verbs:
  - use

---

# Cluster role binding for default pod security policy granting all authenticated users access
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: 100-psp
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: 100-psp
subjects:
- apiGroup: rbac.authorization.k8s.io
  kind: Group
  name: system:authenticated
```

So if a policy is created without any (Cluster)Role bindings, the policy will not be enforced on anybody, **but why do I say it could be 'Yes'?**

Remember, in the YAML sample above, to associate a policy with a role, we need to use `use` in 'verbs' and set 'resources' to `podsecuritypolicy` in 'apiGroups'.

```yaml
- apiGroups:
  - policy
  resourceNames:
  - 100-psp
  resources:
  - podsecuritypolicies
  verbs:
  - use
```

Obviously, if there is a role whose resources include `podsecuritypolicies` and verbs include `use`, the policy will be enforced on that role. However, remember that in YAML, '\*' includes everything. For example, if there is a role defined like this:

```yaml
- apiGroups:
  - '*'
  resources:
  - '*'
  verbs:
  - '*'
```

Since 'resources' `*` includes `podsecuritypolicies` and 'verbs' `*` includes `use`, the policy will also be enforced on that role.

Let's try to find out if we have that kind of role in the existing cluster. To do that, we can run the following commands from bash.

```bash
kubectl get role --all-namespaces -o json | jq '.items[]| {name: .metadata.name, rules: (.rules | map(select(.resources != null)))} | select((.rules[].verbs[] | contains("*") or contains("use"))) | select((.rules[].resources[] | contains("*") or contains("podsecuritypolicies")))'

kubectl get clusterrole -o json | jq '.items[]| {name: .metadata.name, rules: (.rules | map(select(.resources != null)))} | select((.rules[].verbs[] | contains("*") or contains("use"))) | select((.rules[].resources[] | contains("*") or contains("podsecuritypolicies")))'
```

The first command will return nothing, and the second command will give the results below.

```json
{
  "name": "cluster-admin",
  "rules": [
    {
      "apiGroups": [
        "*"
      ],
      "resources": [
        "*"
      ],
      "verbs": [
        "*"
      ]
    }
  ]
}
{
  "name": "system:controller:clusterrole-aggregation-controller",
  "rules": [
    {
      "apiGroups": [
        "*"
      ],
      "resources": [
        "*"
      ],
      "verbs": [
        "*"
      ]
    }
  ]
}
```

It means that when a policy gets defined, it will implicitly be enforced on ClusterRole cluster-admin and system:controller:clusterrole-aggregation-controller.

It also means that the policy will implicitly be enforced on any user/service account that happens to have the cluster-admin role. Let's take a closer look to see who will be affected (ClusterRoleBinding to cluster-admin).

```bash
kubectl get clusterrolebinding -o wide | grep cluster-admiin
```

In the result below, the policy will be enforced on service account kube-system/tiller and group system:masters.

```bash
cluster-admin                                          3d4h    ClusterRole/cluster-admin                                                                           system:masters                                 
tiller                                                 3d4h    ClusterRole/cluster-admin                                                                                                                          kube-system/tiller
```

In an RBAC Kubernetes + TLS certificates cluster, if a client's certificate contains `Subject: O=system:masters, CN=client`, this client will be in group system:masters. In my case, the kubectl client is system:masters, so any Pod created by kubectl will be enforced by newly created pod security policies.

For example, if we re-run `kubectl apply -f pd.yaml`, this time, the error message will be

```bash
Error from server (Forbidden): error when creating "pd.yaml": pods "pd" is forbidden: unable to validate against any pod security policy: [spec.containers[0].securityContext.privileged: Invalid value: true: Privileged containers are not allowed spec.containers[0].securityContext.privileged: Invalid value: true: Privileged containers are not allowed]
```

# 6 How Is a Policy Selected If There Are Multiple Matches?

Refer to [Policy Order](https://kubernetes.io/docs/concepts/policy/pod-security-policy/#policy-order)

> When multiple policies are available, the pod security policy controller selects policies in the following order:
> 
> 1.  If any policies successfully validate the pod without altering it, they are used.
> 2.  If it is a pod creation request, then the first valid policy in alphabetical order is used.
> 3.  Otherwise, if it is a pod update request, an error is returned, because pod mutations are disallowed during update operations.

**Pay special attention here**. Rephrased, this means: if it is a Pod creation request, **the first valid policy without mutating anything in alphabetical order is used**; otherwise, the first valid policy in alphabetical order is used.

It's kind of difficult to understand, so let's use our two policies in 4.1 to demonstrate. We will modify our pd.yaml's setting `privileged` from `true` to `false`, so it will match both 100-psp and 200-psp policies.

```yaml
# pd.yaml
apiVersion: v1
kind: Pod
metadata:
  name: pd
spec:
  containers:
    - name: pause
      image: k8s.gcr.io/pause
      securityContext:
        privileged: true
```

Now, let's create a Pod by issuing `kubectl apply -f pd.yaml`. Then check the `annotations` field from `kubectl get pod pd -o yaml`. We will see `kubernetes.io/psp: 100-psp` is added. That means although we have two policies, 100-psp and 200-psp, matching the condition, the alphabetical order chooses 100-psp.

```yaml
apiVersion: v1
kind: Pod
metadata:
  annotations:
  ...
    kubernetes.io/psp: 100-psp
    seccomp.security.alpha.kubernetes.io/pod: docker/default
  creationTimestamp: "2019-01-15T03:11:57Z"
  name: pd
  namespace: default
```

Now run `kubectl delete pod pd` to delete Pod pd. We will do another test. This time, we remove all annotations from 200-psp.yaml (refer to below) and apply it again by running `kubectl apply -f 200-psp.yaml`.

```yaml
# 200-psp.yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: 200-psp
spec:
  allowedCapabilities:
  - '*'
  allowPrivilegeEscalation: true
  fsGroup:
    rule: 'RunAsAny'
  hostIPC: true
  hostNetwork: true
  hostPID: true
  hostPorts:
  - min: 0
    max: 65535
  privileged: false
  readOnlyRootFilesystem: false
  runAsUser:
    rule: 'RunAsAny'
  seLinux:
    rule: 'RunAsAny'
  supplementalGroups:
    rule: 'RunAsAny'
  volumes:
  - '*'
```

If we create a Pod again by running `kubectl apply -f pd.yaml` and check the `annotations` field from `kubectl get pod pd -o yaml`, we will see `kubernetes.io/psp: 200-psp` is selected this time.

What happened here? Why is alphabetical order not honored here? The reason is:

1.  Previously, although two policies, 100-psp and 200-psp, are valid, they both will mutate the security context of the Pod/container. Hence, the first policy, 100-psp, is chosen in alphabetical order.
2.  Once we remove the "annotations" below from 200-psp, 200-psp will not mutate the Pod/container's security context. It honors **the first valid policy without mutating anything in alphabetical order is used**, so it will be picked instead of 100-psp.
    
    ```yaml
    apparmor.security.beta.kubernetes.io/allowedProfileNames:
      apparmor.security.beta.kubernetes.io/defaultProfileName:  'runtime/default'
      seccomp.security.alpha.kubernetes.io/allowedProfileNames: 'docker/default'
      seccomp.security.alpha.kubernetes.io/defaultProfileName:  'docker/default'
    ```
    
3.  The algorithm described here is in computeSecurityContext of plugin\\pkg\\admission\\security\\podsecuritypolicy\\admission.go.

**Pay attention** to the behavior above. It could potentially bring up a few issues since alphabetical order might not be honored "literally". If two policies are both valid but apply different settings, for example, 200-psp sets `runAsUser` to `MustRunAsNonRoot` and 100-psp sets `runAsUser` to `RunAsAny`, the Pod might not run as expected if the image uses the root user.

# 7 Why Creating a Deployment Failed While Creating a Pod Works

Let's say we have a simple dm.yaml file below, with the pod security policies created above.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dm
spec:
  replicas: 1
  selector:
    matchLabels:
      app: pause  
  template:
    metadata:
      labels:
        app: pause
    spec:
      containers:
      - name: pause
        image: k8s.gcr.io/pause
        securityContext:
          privileged: false
```

When running `kubectl apply -f dm.yaml` and `kubectl get deployment dm`, it shows READY is 0/1.

```bash
NAME   READY   UP-TO-DATE   AVAILABLE   AGE
dm     0/1     0            0           10s
```

Checking `kubectl get event` will show `Error creating: pods "dm-XXXXXXXXXX-"`.

```bash
kubectl get events
LAST SEEN   TYPE      REASON              KIND         MESSAGE
14s         Warning   FailedCreate        ReplicaSet   Error creating: pods "dm-75b5689b9f-" is forbidden: unable to validate against any pod security policy: []
...
```

Why does creating a Pod work while creating a Deployment doesn't? What happens here is:

1.  When we create a Pod from kubectl, it uses the current user's credential. As it is cluster-admin and, as explained in section 5, system:masters has pod security policies enforced, we will find a policy to suit the needs.
2.  When we create a Deployment from kubectl, it uses the current user's credential to create a Deployment. The Kubernetes controller manager sees this Deployment and asks the ReplicaSet controller to create the corresponding Pod. In this case, it uses the ReplicaSet controller's service account. As this service account is not authorized, it ends with the error message "unable to validate against any pod security policy: \[\]".

To solve the issue here, we can define the ClusterRoleBinding below. Apply it by running `kubectl apply -f 200-psp-binding.yaml`. It authorizes the replicaset-controller service account to use the 200-psp pod security policy.

```yaml
# 200-psp-binding.yaml
# Cluster role which grants access to the default pod security policy
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: 200-psp
rules:
- apiGroups:
  - policy
  resourceNames:
  - 200-psp
  resources:
  - podsecuritypolicies
  verbs:
  - use

---

# Cluster role binding for default pod security policy granting all authenticated users access
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: 200-psp
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: 200-psp
subjects:
- kind: ServiceAccount
  name: replicaset-controller
  namespace: kube-system
```

This time, `kubectl apply -f dm.yaml` will create the Pod as expected.

# 8 Summary

To wrap it up, pod security policy enables fine-grained authorization of Pod creation and updates, but it also has some mysterious behavior behind it. I hope this article gives more insight into how it works and helps avoid confusion.
