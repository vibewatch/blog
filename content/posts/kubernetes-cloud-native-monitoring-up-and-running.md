---
title: "Kubernetes Cloud Native Monitoring with TICK & Prometheus - Up and Running"
slug: "kubernetes-cloud-native-monitoring-up-and-running"
date: "2019-03-04 03:35:57"
updated: "2019-03-04 03:50:24"
type: "post"
status: "published"
visibility: "public"
featured: false
excerpt: ""
feature_image: "/assets/posts/kubernetes-cloud-native-monitoring-up-and-running/hero.jpg"
authors: ["Yingting Huang"]
tags: ["Kubernetes", "Prometheus", "TICK", "Monitoring"]
---
# Kubernetes Cloud Native Monitoring with TICK & Prometheus - Up and Running

> **Note (May 2026):** This article uses Helm v2-style commands and older Helm stable charts, including the historical `stable/prometheus-operator` chart. Modern clusters typically use Helm v3, `kube-prometheus-stack`, updated Fluent Bit/Prometheus/Grafana charts, and newer CRD/API versions. Treat the architecture ideas as reference and update the installation commands before applying them today.

# 0 Introduction

This post does not intend to introduce Prometheus or InfluxDB. It serves as a reference for building a monitoring/logging system in Kubernetes with open-source software.
The monitoring/logging/alerting system consists of four open-source software components. Refer to the diagram below.
![K8SMon-Arch](/assets/posts/kubernetes-cloud-native-monitoring-up-and-running/k8smon-arch.svg)

1.  [Fluent Bit](https://fluentbit.io/) is used for log collection. Fluent Bit is deployed as a Kubernetes DaemonSet to all Kubernetes nodes. It collects container logs and enriches them with metadata from the Kubernetes API.
2.  [InfluxDB](https://www.influxdata.com) is used to store collected/enriched logs from Fluent Bit.
3.  [Prometheus](https://prometheus.io) is used for monitoring. It pulls metrics from service monitoring targets and stores metrics in its own time-series database.
4.  [Grafana](https://grafana.com/) is used for metrics analytics and visualization. It serves as a dashboard system.

# 1 Prerequisites

The whole deployment requires Helm, charts, and a few customized configuration files. Follow the steps below to download them in advance.

## 1.1 Helm

Refer to [Install applications with Helm in Azure Kubernetes Service (AKS)](https://github.com/MicrosoftDocs/azure-docs/blob/master/articles/aks/kubernetes-helm.md) to install Helm.

## 1.2 TICK Charts

Clone TICK charts from the repository below.

```bash
git clone https://github.com/influxdata/tick-charts.git
```

TICK stands for

*   T - Telegraf
*   I - InfluxDB
*   C - Chronograf
*   K - Kapacitor

## 1.3 Monitoring Configuration Files

Download the Kubernetes monitoring configuration files from the repository below.

```bash
git clone https://github.com/huangyingting/k8smon.git
```

# 2 Install/Configure TICK Stack & Fluentbit for Logging

## 2.1 Install TICK Stack

From command prompt/shell, change directory to tick-charts(cloned from section 1.2)

```bash
helm install --name data --namespace tick ./influxdb/ --set persistence.enabled=true,persistence.size=16Gi,config.udp.enabled=true

helm install --name alerts --namespace tick ./kapacitor/ --set persistence.enabled=true,persistence.size=8Gi

helm install --name dash --namespace tick ./chronograf/

helm install --name polling --namespace tick ./telegraf-s/
```

## 2.2 Configure InfluxDB UDP Port

The default setting of InfluxDB is incorrect for UDP service, so we need to change the protocol from TCP to UDP with the steps below.
`kubectl edit service data-influxdb -n=tick`  
Modify

```yaml
  - name: udp
    port: 8089
    protocol: TCP
    targetPort: 8089
```

To

```yaml
  - name: udp
    port: 8089
    protocol: UDP
    targetPort: 8089
```

## 2.3 InfluxDB Configuration

From command prompt/shell, run `kubectl port-forward svc/dash-chronograf -n=tick 8080:80`  
Open a browser and access [http://localhost:8080](http://localhost:8080), then follow the wizard and set:

*   InfluxDB address to [http://data-influxdb.tick:8086](http://data-influxdb.tick:8086)
*   Kapacitor address to [http://alerts-kapacitor.tick:9092](http://alerts-kapacitor.tick:9092)
  From "InfluxDB Admin", create two databases called "fluentbit" and "telegraf" with the settings below.
    ![InfluxDB-Conf](/assets/posts/kubernetes-cloud-native-monitoring-up-and-running/influxdb-conf.jpg)

## 2.4 Install Fluentbit to Collect Container's Log

Fluent Bit is a lightweight log collector. According to [Fluent Bit](https://fluentbit.io/):

> Fluent Bit is an open source and multi-platform Log Processor and Forwarder which allows you to collect data/logs from different sources, unify and send them to multiple destinations. It's fully compatible with Docker and Kubernetes environments.
> Fluent Bit is used here to collect and populate Kubernetes container logs into InfluxDB. To install it into Kubernetes, change directory to k8smon.

```bash
kubectl create namespace logging
kubectl apply -f fluentbit-config.yaml
kubectl apply -f fluentbit-ds.yaml
```

## 2.5 Verify Log Collecting

Fluent Bit should start collecting container logs and storing them in InfluxDB. To verify it works properly, go to Chronograf "Explore" and highlight the "fluentbit" database. It should list container measurements as shown below.
![InfluxDB-Explore](/assets/posts/kubernetes-cloud-native-monitoring-up-and-running/influxdb-explore.jpg)

# 3 Install/Configure Prometheus for Monitoring

[Prometheus](https://prometheus.io/docs/introduction/overview/) is an open-source systems monitoring and alerting toolkit originally built at SoundCloud.

We choose Prometheus Operator because it has a set of preconfigured dashboards and alerts.

## 3.1 Install Prometheus Operator

Change directory to k8smon, then from command prompt/shell, run

```bash
helm install --name prom --namespace prom stable/prometheus-operator -f prometheus_values.yaml
```

## 3.2 Configure ETCD Monitoring

Newer Kubernetes clusters should have SSL/TLS enabled for etcd, and Prometheus needs a client certificate to monitor etcd. For example, in a kubeadm-based cluster, the client certificate, client key, and CA certificate are in the master node's /etc/kubernetes/pki/etcd directory. Copy/rename the CA certificate to ca.crt, the etcd client certificate to etcd.crt, and the etcd client key to etcd.key, then create a YAML file with the following commands.

```bash
cat <<-EOF > etcd-client-cert.yaml
apiVersion: v1
data:
  etcd-ca.crt: "$(cat ca.crt | base64 --wrap=0)"
  etcd-client.crt: "$(cat etcd.crt | base64 --wrap=0)"
  etcd-client.key: "$(cat etcd.key | base64 --wrap=0)"
kind: Secret
metadata:
  name: etcd-client-cert
  namespace: prom
type: Opaque
EOF
```

And apply it to the Kubernetes cluster.
`kubectl apply -f etcd-client-cert.yaml`

## 3.3 Configure Controller Manager and Scheduler Monitoring

Monitoring the Kubernetes controller manager and scheduler requires them to listen on the 0.0.0.0 address. If Kubernetes is deployed with kubeadm, we need to change the following settings and then reboot the master node.

```bash
sed -e "s/- --address=127.0.0.1/- --address=0.0.0.0/" -i /etc/kubernetes/manifests/kube-controller-manager.yaml
sed -e "s/- --address=127.0.0.1/- --address=0.0.0.0/" -i /etc/kubernetes/manifests/kube-scheduler.yaml
```

## 3.4 Configure Telegraf Output to Prometheus

We'd like to use Prometheus to collect InfluxDB's metrics and have InfluxDB monitored by Prometheus. Unfortunately, InfluxDB doesn't expose its metrics to Prometheus. However, Telegraf can collect InfluxDB's metrics and output them to Prometheus, so we can configure Telegraf to transmit InfluxDB metrics to Prometheus. To do that, change directory to tick-charts, then run the following from a command prompt or shell.

```bash
helm upgrade polling --namespace tick ./telegraf-s/ -f ../k8smon/telegraf_values.yaml
```

## 3.5 Verify Monitoring

Prometheus should start to collect metrics, to verify it works appropriately, from command prompt/shell, run

```bash
kubectl port-forward svc/prom-prometheus-operator-prometheus -n=prom 9090:9090
```

Now, open a browser and visit  
[http://localhost:9090/targets](http://localhost:9090/targets)  
All targets should be green.
![Prom-Targets](/assets/posts/kubernetes-cloud-native-monitoring-up-and-running/prom-targets.jpg)  
Also, when accessing [http://localhost:9090/graph](http://localhost:9090/graph), all metrics should be populated.
![Prom-Metrics](/assets/posts/kubernetes-cloud-native-monitoring-up-and-running/prom-metrics.jpg)

# 4 Alerting

Refer to [Alerting overview](https://prometheus.io/docs/alerting/overview/#alerting-overview)

> Alerting with Prometheus is separated into two parts. Alerting rules in Prometheus servers send alerts to an Alertmanager. The Alertmanager then manages those alerts, including silencing, inhibition, aggregation and sending out notifications via methods such as email, PagerDuty and HipChat.

The default configuration in prometheus\_values.yaml will redirect alerts to a null notification channel.

```yaml
  config:
    global:
      resolve_timeout: 5m
    route:
      group_by: ['job']
      group_wait: 30s
      group_interval: 5m
      repeat_interval: 12h
      receiver: 'null'
      routes:
      - match:
          alertname: Watchdog
        receiver: 'null'
    receivers:
    - name: 'null'
```

To enable sending alerts to MSTeams, we can

1.  From prometheus\_values.yaml, comment out above configurations and uncomment below part

```yaml
    route:
      group_by: ['alertname', 'job']
      group_wait: 30s
      group_interval: 1m
      repeat_interval: 12h
      receiver: 'prometheus-msteams'
      routes:
      - match:
          alertname: Watchdog
        receiver: 'prometheus-msteams'
    receivers:
    - name: 'prometheus-msteams'
      webhook_configs:
      - send_resolved: true
        url: 'http://prometheus-msteams.prom:2000/alertmanager'
```

2.  Run `helm upgrade prom --namespace prom stable/prometheus-operator -f prometheus_values.yaml` to update the settings
3.  Clone prometheus-msteams with `https://github.com/bzon/prometheus-msteams.git`
4.  From MSTeams, correct a webhook for a channel, then open values.yaml, set alertmanager to webhook URL

```yaml
connectors:
  - alertmanager: https://outlook.office.com/webhook/xxx/IncomingWebhook/xxx/xxx
```

5.  Run `helm install --name prometheus-msteams ./prometheus-msteams --namespace prom` to install prometheus-msteams

If it is configured correctly, you should be able to receive alerts from prometheus in MSTeams  
![Prom-Alerts](/assets/posts/kubernetes-cloud-native-monitoring-up-and-running/prom-alerts.jpg)

Prometheus has an alert manager to review all alerts, it can be accessed with  
`kubectl port-forward svc/prom-prometheus-operator-alertmanager -n=prom 9093:9093`  
Then open a browser to [http://localhost:9093/#/alerts](http://localhost:9093/#/alerts)  
![Prom-AlertManager](/assets/posts/kubernetes-cloud-native-monitoring-up-and-running/prom-alertmanager.jpg)

# 5 Grafana

The default setup will install a few preconfigured dashboards into Grafana. To access those dashboards, we need to log in to Grafana first.

1.  Follow the steps below to get the username/password.

```bash
kubectl get secret -n=prom prom-grafana -o jsonpath="{.data.admin-user}"|base64 --decode;echo
kubectl get secret -n=prom prom-grafana -o jsonpath="{.data.admin-password}"|base64 --decode;echo
```

2.  Run `kubectl port-forward svc/prom-grafana -n=prom 18080:80`, open a browser to access [http://localhost:18080/login](http://localhost:18080/login), and log in with the username/password retrieved from step 1.
3.  From "Home", find those preconfigured dashboards.
    ![Grafana-DashList](/assets/posts/kubernetes-cloud-native-monitoring-up-and-running/grafana-dashlist.jpg)
4.  Click any of them, for example "Node" dashboard will list all performance metrics  
    ![Grafana-NodeDash](/assets/posts/kubernetes-cloud-native-monitoring-up-and-running/grafana-nodedash.jpg)

# 6 Summary

The setup above should get monitoring/alerting/logging up and running for the Kubernetes cluster. This solution could also be applied to a small or mid-sized self-hosted Kubernetes cluster.
