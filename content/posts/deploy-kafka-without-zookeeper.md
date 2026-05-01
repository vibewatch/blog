---
title: "Deploy Kafka without ZooKeeper on Kubernetes"
slug: "deploy-kafka-without-zookeeper"
date: "2023-01-15 12:08:54"
updated: "2023-01-15 12:08:54"
type: "post"
status: "published"
visibility: "public"
featured: false
excerpt: ""
feature_image: "https://images.unsplash.com/photo-1463528073420-8b7658275ffa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwxMTc3M3wwfDF8c2VhcmNofDF8fGthZmthfGVufDB8fHx8MTY3Mzc4NDUxMA&ixlib=rb-4.0.3&q=80&w=2000"
authors: ["Yingting Huang"]
tags: []
---
Most of the work is based on [https://github.com/bitnami/charts/issues/13624](https://github.com/bitnami/charts/issues/13624), this article here is only for documentation purposes only, we use community kafka helm chart from bitnami/kafka

First, we need to have a values.yaml files with content in below, to test purpose, we set \`replicaCount\` to 1, it can be adjusted to 3, 5 etc.

```yaml
extraDeploy:
  - |
    apiVersion: v1
    kind: ConfigMap
    metadata:
      name: kafka-custom-scripts
      namespace: {{ .Release.Namespace }}
      labels: {{- include "common.labels.standard" . | nindent 4 }}
    data:
      kraft-setup.sh: |-
        #!/bin/bash

        ## Set value for `KAFKA_CFG_BROKER_ID`
        if [[ -f "/bitnami/kafka/data/meta.properties" ]]; then
          # Sub-sequences deployment AND Persistence enabled
          BROKER_ID=$(grep "node.id" /bitnami/kafka/data/meta.properties | awk -F '=' '{print $2}')
          BROKER_ID=$(echo $BROKER_ID | tr -d '"')
          export KAFKA_CFG_BROKER_ID=$(echo $BROKER_ID)
        else
          # First deployment OR Persistence disabled
          POD_NAME=$(grep "statefulset.kubernetes.io/pod-name" /etc/podinfo/labels | awk -F '=' '{print $2}')
          POD_NAME=$(echo $POD_NAME | tr -d '"')
          export KAFKA_CFG_BROKER_ID=$(echo $POD_NAME | rev | cut -d'-' -f 1 | rev)
        fi
        echo "KAFKA_CFG_BROKER_ID: ${KAFKA_CFG_BROKER_ID}"

        ## Set value for `KAFKA_CFG_CONTROLLER_QUORUM_VOTERS`
        REPLICAS={{ .Values.replicaCount }}
        CONTROLLER_QUORUM_VOTERS=""
        for i in $( seq 0 $REPLICAS); do
          if [[ $i != $REPLICAS ]]; then
            BROKER_ID="$((i + 0))"
            BROKER_URL="{{ include "common.names.fullname" . }}-$BROKER_ID.{{ include "common.names.fullname" . }}-headless.{{ .Release.Namespace }}.svc.{{ .Values.clusterDomain }}:{{ .Values.service.ports.internal }}"
            CONTROLLER_QUORUM_VOTERS="$CONTROLLER_QUORUM_VOTERS$BROKER_ID@$BROKER_URL,"
          else
            CONTROLLER_QUORUM_VOTERS=${CONTROLLER_QUORUM_VOTERS::-1}
          fi
        done
        export KAFKA_CFG_CONTROLLER_QUORUM_VOTERS="${CONTROLLER_QUORUM_VOTERS}"
        echo "KAFKA_CFG_CONTROLLER_QUORUM_VOTERS: ${KAFKA_CFG_CONTROLLER_QUORUM_VOTERS}"

        ## Continue with default execution
        exec /entrypoint.sh /run.sh

autoCreateTopicsEnable: true
listeners:
  - PLAINTEXT://:9092
  - CONTROLLER://:9093
advertisedListeners:
  - PLAINTEXT://:9092
listenerSecurityProtocolMap: "CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,INTERNAL:PLAINTEXT"
interBrokerListenerName: PLAINTEXT
extraEnvVars:
  - name: KAFKA_ENABLE_KRAFT
    value: "yes"
  - name: KAFKA_KRAFT_CLUSTER_ID
    value: "s_vb8yLzRnyOVW3Ko2mUbg"
  - name: KAFKA_CFG_PROCESS_ROLES
    value: "broker,controller"
  - name: KAFKA_CFG_CONTROLLER_LISTENER_NAMES
    value: "CONTROLLER"
extraVolumes:
  - name: kafka-custom-scripts
    configMap:
      name: kafka-custom-scripts
      defaultMode: 0755
  - name: podinfo
    downwardAPI:
      items:
        - path: "labels"
          fieldRef:
            fieldPath: metadata.labels
        - path: "annotations"
          fieldRef:
            fieldPath: metadata.annotations
extraVolumeMounts:
  - name: kafka-custom-scripts
    mountPath: /scripts/kraft-setup.sh
    subPath: kraft-setup.sh
  - name: podinfo
    mountPath: /etc/podinfo
command:
  - "/scripts/kraft-setup.sh"

replicaCount: 1

volumePermissions:
  enabled: true

zookeeper:
  enabled: false

metrics:
  kafka:
    enabled: true
  serviceMonitor:
    enabled: true
    labels:
      release: prometheus
```

Then run below commands to deploy Kafka

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
kubectl create ns kafka
helm install kafka --values values.yaml -n kafka bitnami/kafka
```

To test if Kafka functions normally, we can open two terminal windows

On terminal window 1 run below commands then send some messages from console

```bash
kubectl exec --tty -i kafka-0 --namespace kafka -- bash
kafka-console-producer.sh --broker-list kafka.kafka.svc.cluster.local:9092 --topic console
```

On terminal window 2 run below commands to get messages from producer

```bash
kubectl exec --tty -i kafka-0 --namespace kafka -- bash
kafka-console-consumer.sh --bootstrap-server kafka.kafka.svc.cluster.local:9092 --topic console --from-beginning
```
