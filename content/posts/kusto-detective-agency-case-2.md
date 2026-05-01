---
title: "Kusto Detective Agency Case 2"
slug: "kusto-detective-agency-case-2"
date: "2023-01-10 02:54:39"
updated: "2023-01-10 02:54:39"
type: "post"
status: "published"
visibility: "public"
featured: false
excerpt: ""
feature_image: ""
authors: ["Yingting Huang"]
tags: []
---
## Election fraud?

The mayor of Digitown, Mrs. Gaia Budskott, has found herself in quite a pickle. The election for the city’s mascot was run online for the first time, and it was a huge success! Or was it??  
  
Over 5 million people voted. Four candidates made it to the final round:

*   \- Kastor the Elephant – The darling of Digitown Zoo
*   \- Gaul the Octopus – A Digitown celebrity, who was a whiz at predicting who’d win the local soccer games
*   \- William (Willie) the Tortoise – Digitown’s oldest living creature (estimated age - 176.4 years)
*   \- Poppy the Goldfish – ex-Mayor Jason Guvid’s childhood pet  
    The polls predicted a close battle between Kastor and Gaul, but the actual results showed that the ex-mayor’s fish got a whopping 51.7% of all votes! That sure does sound fishy...  
    The mayor is afraid of a vote-tampering scandal that could affect all elections in Digitown! You’ve helped her out last time, and she’s counting on you to get to the bottom of this mystery.  
      
    If voting fraud happened – prove it and correct the election numbers: what percentage of the votes did each candidate get?  
      
    You have access to the elections data: IP, anonymized id, vote, date-time - and the function used for counting the votes.  
      
    Good luck, rookie. We’re counting on you.

```kql
.execute database script <|
// Ingestion may take ~40sec to complete, total 5M+ records
.create-merge table Votes (Timestamp:datetime, vote:string, via_ip:string, voter_hash_id:string)
.ingest async into table Votes (@'https://kustodetectiveagency.blob.core.windows.net/digitown-votes/votes_1.csv.gz')
.ingest async into table Votes (@'https://kustodetectiveagency.blob.core.windows.net/digitown-votes/votes_2.csv.gz')
.ingest async into table Votes (@'https://kustodetectiveagency.blob.core.windows.net/digitown-votes/votes_3.csv.gz')

// Query that counts the votes:
Votes
| summarize Count=count() by vote
| as hint.materialized=true T
| extend Total = toscalar(T | summarize sum(Count))
| project vote, Percentage = round(Count*100.0 / Total, 1), Count
| order by Count
```

**What percentage of the votes did each candidate get?**

**Kastor**: \[\] **Gaul**: \[\] **Willie**: \[\] **Poppy**: \[\]

## Case 2 - Solution

```kql
Votes
| summarize Count = count() by vote, bin(Timestamp, 1s), via_ip
| where Count < 2
| summarize Count=count() by vote
| as hint.materialized=true T
| extend Total = toscalar(T | summarize sum(Count))
| project vote, Percentage = round(Count*100.0 / Total, 1), Count
| order by Count
```

**Kastor**: \[50.8%\] **Gaul**: \[38.6%\] **Willie**: \[6.6%\] **Poppy**: \[4%\]
