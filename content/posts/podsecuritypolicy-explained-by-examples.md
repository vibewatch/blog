---
title: "Pod Security Policy Explained By Examples"
slug: "podsecuritypolicy-explained-by-examples"
date: "2019-01-15 07:08:00"
updated: "2019-01-15 09:02:46"
type: "post"
status: "published"
visibility: "public"
featured: true
excerpt: "Pod security policy enables fine-grained authorization of pod creation and updates but it also has some mysterious things behind, this article gives more insight about how it works."
feature_image: "/assets/posts/podsecuritypolicy-explained-by-examples/hero.jpg"
authors: ["Yingting Huang"]
tags: ["Kubernetes", "K8S", "PodSecurityPolicy"]
---
# 1 What is pod security policy?

> A Pod Security Policy is a cluster-level resource that controls security sensitive aspects of the pod specification. The PodSecurityPolicy objects define a set of conditions that a pod must run with in order to be accepted into the system, as well as defaults for the related fields.

# 2 How to enable pod security policy admission controller

> PodSecurityPolicies are enforced by enabling the admission controller

It can be enabled by adding `--enable-admission-plugins=PodSecurityPolicy,...` to kube-apiserver configuration file, for example /etc/kubernetes/manifest/kube-apiserver.yaml

# 3 What happens after enabling pod security policy admission controller

> but doing so without authorizing any policies will prevent any pods from being created in the cluster.

That means, if PodSecurityPolicy is enabled but without any policies defined, creating any pods in kubernetes cluster will be blocked.

For example, in a kubernetes cluster without any PodSecurityPolicy defined

```bash
kubectl get psp
No resources found.
```

Try to deploy a Pod with definition in below

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

With command `kubectl apply -f pd.yaml`, it will report below error

```bash
Error from server (Forbidden): error when creating "pd.yaml": pods "pd" is forbidden: no providers available to validate pod request
```

# 4 How to add pod security policies

We will create two pod security policies here and use them for further explanations, 100-psp.yaml is a restricted policy and 200-psp.yaml is a privileged policy.

For more information about how to define pod security policy, refe to [Create a policy and a pod](https://kubernetes.io/docs/concepts/policy/pod-security-policy/#create-a-policy-and-a-pod)

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

## 2.Apply the policies

Run `kubectl apply -f 100-psp.yaml` and `kubectl apply -f 200-psp.yaml`, above two pod security policies will be added to system.

# 5 Will the newly created policies enforce now

The answer can be either 'Yes' or 'No', refer to [Authorizing Policies](https://kubernetes.io/docs/concepts/policy/pod-security-policy/#authorizing-policies)

> When a PodSecurityPolicy resource is created, it does nothing. In order to use it, the requesting user or target pod’s service account must be authorized to use the policy, by allowing the use verb on the policy.

Basically, it means in order to enforce a policy, we need to create a (Cluster)Role which grants access to pod security policy, then bind this (Cluster)Role to certain users or service accounts. When those users or service accounts try to create a pod, they will be validated by that pod security policy.

For example, we can define a simple yaml to bind 100-psp policy to system:authenticated group, so all authenticated users/service accounts will be enforced/validated by 100-psp policy.

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

So if a policy get created without any (Cluster)Role bindings, the policy will not be enforced to anybody, **but why I say it could be 'Yes'**.

Remember, in above yaml sample, to associate a policy to a role, we need to use `use` 'verbs' and set 'resources' to `podsecuritypolicy` in 'apiGroups'

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

Obviously, if there is a role whose resources includes `podsecuritypolicies` and verbs includes `use`, the policy will be enforced on that role, however, remember in yaml '\*' include everything, for example if there is a role defines like that

```yaml
- apiGroups:
  - '*'
  resources:
  - '*'
  verbs:
  - '*'
```

since 'resources' `*` include `podsecuritypolicies` and 'verbs' `*` include `use`, the policy will also enforce on that role as well.

Let's try to find out if we have that kind of role from existing cluster, to do that, we can run below command from bash

```bash
kubectl get role --all-namespaces -o json | jq '.items[]| {name: .metadata.name, rules: (.rules | map(select(.resources != null)))} | select((.rules[].verbs[] | contains("*") or contains("use"))) | select((.rules[].resources[] | contains("*") or contains("podsecuritypolicies")))'

kubectl get clusterrole -o json | jq '.items[]| {name: .metadata.name, rules: (.rules | map(select(.resources != null)))} | select((.rules[].verbs[] | contains("*") or contains("use"))) | select((.rules[].resources[] | contains("*") or contains("podsecuritypolicies")))'
```

First command will return nothing, second command will give results in below

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

It means, when a policy get defined, implicitly it will enforce on ClusterRole cluster-admin and system:controller:clusterrole-aggregation-controller.

It also means implicitly that policy will enforce on any user/service account who happens to be cluster-admin role, Let take a close look to see who will be affected(ClusterRoleBinding to cluster-admin)

```bash
kubectl get clusterrolebinding -o wide | grep cluster-admiin
```

In below result, policy will enforce on service account kube-system/tiller and group system:masters

```bash
cluster-admin                                          3d4h    ClusterRole/cluster-admin                                                                           system:masters                                 
tiller                                                 3d4h    ClusterRole/cluster-admin                                                                                                                          kube-system/tiller
```

In a RBAC kubernetes + TLS certificates cluster, if a client's certificate contains `Subject: O=system:masters, CN=client`, this client will be in group system:masters, in my case, kubectl client is system:masters, so any Pod created by kubectl will be enforced by newly created pod security policies.

For example, if we re-run `kubectl apply -f pd.yaml`, this time, the error message will be

```bash
Error from server (Forbidden): error when creating "pd.yaml": pods "pd" is forbidden: unable to validate against any pod security policy: [spec.containers[0].securityContext.privileged: Invalid value: true: Privileged containers are not allowed spec.containers[0].securityContext.privileged: Invalid value: true: Privileged containers are not allowed]
```

# 6 How policy get selected if there are multiple matches

Refer to [Policy Order](https://kubernetes.io/docs/concepts/policy/pod-security-policy/#policy-order)

> When multiple policies are available, the pod security policy controller selects policies in the following order:
> 
> 1.  If any policies successfully validate the pod without altering it, they are used.
> 2.  If it is a pod creation request, then the first valid policy in alphabetical order is used.
> 3.  Otherwise, if it is a pod update request, an error is returned, because pod mutations are disallowed during update operations.

**Pay special attention here**, the rephrased words should be, If it is a pod creation request, **the first valid without mutating anything policy in alphabetical order is used**, otherwise the first valid policy in alphabetical order is used.

It's kind of difficult to understand, so let's use our two policies in 4.1 to demonstrate, we will modify our pd.yaml's setting `privileged` from `true` to `false` so it will match both 100-psp and 200-psp policies.

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

Now, let's create a Pod by issuing `kubectl apply -f pd.yaml`. Then check `annotations` field from `kubectl get pod pd -o yaml`, we will see `kubernetes.io/psp: 100-psp` is added, that means although we have two policies 100-psp and 200-psps match the condition, but we choose the alphabetical order 100-psp.

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

Now run `kubectl delete pod pd` to delete Pod pd, we will do another test, this time, we remove all annotations from 200-psp.yaml(refer to below) and apply it again by running `kubectl apply -f 200-psp.yaml`

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

If we create a Pod again by running `kubectl apply -f pd.yaml` and check `annotations` field from `kubectl get pod pd -o yaml`, we will see `kubernetes.io/psp: 200-psp` is selected this time.

What happens here, why alphabetical order is not honored here, the reason is

1.  Previously, although two policies 100-psp and 200-psp are valid, but they both will mutate the security context of pod/container, hence, the first policy 100-psp in alphabetical order is choose.
2.  Once we removed "annotations" below from 200-psp, 200-psp will not mutate pod/container's security context, it honors **the first valid without mutating anything policy in alphabetical order is used**, so it will be picked up instead of 100-psp.
    
    ```apparmor.security.beta.kubernetes.io/allowedProfileNames:
     apparmor.security.beta.kubernetes.io/defaultProfileName:  'runtime/default'
     seccomp.security.alpha.kubernetes.io/allowedProfileNames: 'docker/default'
     seccomp.security.alpha.kubernetes.io/defaultProfileName:  'docker/default'```
    ```
    
3.  The algorithm desribed here is in computeSecurityContext of plugin\\pkg\\admission\\security\\podsecuritypolicy\\admission.go.

**Pay attentions** to above behavior, it could potentially bring up a few of issues since the alphabetical order might not be honored "literally", if two policies are both valid but they applied different setting, for example, 200-psp set `runAsUser` to `MustRunAsNonRoot` and 100-psp set `runAsUser` to `RunAsAny`, the Pod might not be run as expected if the image uses user root.

# 7 Why create a deployment failed while create a pod works

Let's say we have a simple dm.yaml file in below, with pod security policies created above

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

When run `kubectl apply -f dm.yaml` and `kubectl get deployment dm`, it shows READY is 0/1

```bash
NAME   READY   UP-TO-DATE   AVAILABLE   AGE
dm     0/1     0            0           10s
```

Check `kubectl get event` will shows `Error creating: pods "dm-XXXXXXXXXX-"`

```bash
kubectl get events
LAST SEEN   TYPE      REASON              KIND         MESSAGE
14s         Warning   FailedCreate        ReplicaSet   Error creating: pods "dm-75b5689b9f-" is forbidden: unable to validate against any pod security policy: []
...
```

Why creating a pod works while creating a deployment doesn't work? What happens here is

1.  When we create a pod from kubectl, it uses current user's credential, as it is cluster-admin and explained in section 5, system:masters has pod security policies enforced, so we will find a policy to suit the needs.
2.  When we create a deployment from kubectl, it uses current user's credential to create a deployment, kubernetes controller manager sees this deployment and will ask replicaset controller to create corresponding pod, in this case, it uses replicaset controller's service account, as this service account is not authorized, it ends with error message "unable to validate against any pod security policy: \[\]".

To solve the issue here, we can define below ClusterRoleBinding, apply it by running `kubectl apply -f 200-psp-binding.yaml`, it authorizes replicaset-controller service account to 200-psp pod security policy

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

This time, `kubectl apply -f dm.yaml` will have pod created as expected.

# 8 Summary

Wrap it up, pod security policy enables fine-grained authorization of pod creation and updates but it also has some mysterious things behind, hope this article gives more insight about how it works and avoids any confusion here.
