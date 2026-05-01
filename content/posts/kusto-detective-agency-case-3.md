---
title: "Kusto Detective Agency Case 3"
slug: "kusto-detective-agency-case-3"
date: "2023-01-10 02:59:29"
updated: "2023-01-10 02:59:29"
type: "post"
status: "published"
visibility: "public"
featured: false
excerpt: ""
feature_image: ""
authors: ["Yingting Huang"]
tags: []
---
## Bank robbery

We have a situation, rookie.  
As you may have heard from the news, there was a bank robbery earlier today.  
In short: the good old downtown bank located at 157th Ave / 148th Street has been robbed.  
The police were too late to arrive and missed the gang, and now they have turned to us to help locating the gang.  
No doubt the service we provided to the mayor Mrs. Gaia Budskott in past - helped landing this case on our table now.  
  
Here is a precise order of events:

*   **08:17AM**: A gang of three armed men enter a bank located at 157th Ave / 148th Street and start collecting the money from the clerks.
*   **08:31AM**: After collecting a decent loot (est. 1,000,000$ in cash), they pack up and get out.
*   **08:40AM**: Police arrives at the crime scene, just to find out that it is too late, and the gang is not near the bank. The city is sealed - all vehicles are checked, robbers can't escape. Witnesses tell about a group of three men splitting into three different cars and driving away.
*   **11:10AM**: After 2.5 hours of unsuccessful attempts to look around, the police decide to turn to us, so we can help in finding where the gang is hiding.

Police gave us a data set of cameras recordings of all vehicles and their movements from 08:00AM till 11:00AM. Find it below.  
  
Let's cut to the chase. It's up to you to locate gang’s hiding place!  
Don't let us down!

```kql
.execute database script <|
// Create the table with the traffic information.
// The data loading process estimated to take ~3-4min to complete (114M+ rows of data).
// Notes: VIN - is Vehicle ID 
.create-merge table Traffic (Timestamp:datetime, VIN:string, Ave:int, Street:int)
.ingest async into table Traffic (@'https://kustodetectiveagency.blob.core.windows.net/digitown-traffic/log_00000.csv.gz')
.ingest async into table Traffic (@'https://kustodetectiveagency.blob.core.windows.net/digitown-traffic/log_00001.csv.gz')
.ingest async into table Traffic (@'https://kustodetectiveagency.blob.core.windows.net/digitown-traffic/log_00002.csv.gz')
```

**Where is the gang located? Avenue**: \[\] **Street**: \[\]

## Case 3 - Solution

```kql
let PossibleCars = Traffic| where Timestamp between (datetime(2022-10-16T08:31:00Z)..datetime(2022-10-16T08:40:00Z))| where ((Ave == 157 and Street == 148)) or (Ave == 156 and Street == 148) or (Ave == 158 and Street == 148) or (Ave == 157 and Street == 147) or (Ave == 157 and Street == 149)| summarize VINS = make_set(VIN);

let ParkedCars = Traffic| where Timestamp > datetime(2022-10-16T08:40:00Z)| summarize arg_max(Timestamp, *) by VIN| summarize ParkedVINS=make_set(VIN) by Ave, Street;

PossibleCars | extend dummy=1 | join kind=inner (ParkedCars | extend dummy=1) on dummy| project Ave, Street, set_intersect(VINS, ParkedVINS)| where array_length(Column1) > 2
```

**The gang is located? Avenue**: \[42\] **Street**: \[258\]
