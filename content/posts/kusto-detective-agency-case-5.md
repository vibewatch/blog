---
title: "Kusto Detective Agency Case 5"
slug: "kusto-detective-agency-case-5"
date: "2023-01-10 05:48:45"
updated: "2023-01-14 12:32:39"
type: "post"
status: "published"
visibility: "public"
featured: false
excerpt: ""
feature_image: ""
authors: ["Yingting Huang"]
tags: []
---
## **El Puente - Big heist**  

Hello. It's going to happen soon: a big heist. You can stop it if you are quick enough. Find the exact place and time it’s going to happen.  
Do it right, and you will be rewarded, do it wrong, and you will miss your chance.  
  
Here are some pieces of the information:  
The heist team has 4 members. They are very careful, hide well with minimal interaction with the external world. Yet, they use public chat-server for their syncs. The data below was captured from the chat-server: it doesn't include messages, but still it may be useful. See what you can do to find the IPs the gang uses to communicate.  
Once you have their IPs, use my small utility to sneak into their machine’s and find more hints:  
https://sneakinto.z13.web.core.windows.net/<ip>  
  
Cheers  
El Puente  
  
_PS:_  
_Feeling uncomfortable and wondering about an elephant in the room: why would I help you?_  
_Nothing escapes you, ha?_  
_Let’s put it this way: we live in a circus full of competition. I can use some of your help, and nothing breaks if you use mine... You see, everything is about symbiosis._  
_Anyway, what do you have to lose? Look on an illustrated past, fast forward N days and realize the future is here._

```kql
.execute database script <|
.create-merge table ChatLogs (Timestamp:datetime, Message:string)  
.ingest into table ChatLogs ('https://kustodetectiveagency.blob.core.windows.net/digitown-chat/log_00000.csv.gz')
.ingest into table ChatLogs ('https://kustodetectiveagency.blob.core.windows.net/digitown-chat/log_00001.csv.gz')
```

**What is the exact place and time?**

**Date**: \[\] **Longitude**: \[\] **Latitude**: \[\]

## Solution 5 - Solution

```kql
let Joined = ChatLogs
| where Message has "joined the channel"
| extend User = extract("User \\'(.+)\\' joined", 1, Message), Channel = extract("joined the channel \\'(.+)\\'", 1, Message)
| summarize Count=count() by bin(Timestamp, 1m), Channel
| where Count == 4
| summarize by Channel, Count;
let Left = ChatLogs
| where Message has "left the channel"
| extend User = extract("User \\'(.+)\\' left", 1, Message), Channel = extract("left the channel \\'(.+)\\'", 1, Message)
| summarize Count=count() by bin(Timestamp, 1d), Channel
| where Count == 4
| summarize by Channel, Count;
Joined 
| join kind=innerunique Left on Channel
| project Channel;

let Users= ChatLogs
| where Message has "joined the channel"
| extend User = extract("User \\'(.+)\\' joined", 1, Message), Channel = extract("joined the channel \\'(.+)\\'", 1, Message)
| where Channel == "cf053de3c7b"
| summarize by User;
let Ips = ChatLogs
| where Message has "logged in from"
| extend User = extract("User \\'(.+)\\' logged", 1, Message), Ip = extract("logged in from \\'(\\d+\\.\\d+\\.\\d+\\.\\d+)\\'", 1, Message)
| summarize by User, Ip;
Users
| join kind=innerunique Ips on User
| project User, Ip
```

**Now we have 4 user's ips to sneak in**

u8819ece9b0 [https://sneakinto.z13.web.core.windows.net/119.10.30.154](https://sneakinto.z13.web.core.windows.net/119.10.30.154)  
uab8088061c [https://sneakinto.z13.web.core.windows.net/194.243.69.176](https://sneakinto.z13.web.core.windows.net/194.243.69.176)  
uaf9f4fef17 [https://sneakinto.z13.web.core.windows.net/236.48.237.42](https://sneakinto.z13.web.core.windows.net/236.48.237.42)  
uf034c98df3 [https://sneakinto.z13.web.core.windows.net/146.49.19.37](https://sneakinto.z13.web.core.windows.net/146.49.19.37)

The image below has date info

[https://sneakinto.z13.web.core.windows.net/119.10.30.154/message-project-x.png](https://sneakinto.z13.web.core.windows.net/119.10.30.154/message-project-x.png)

![Project X message](/assets/posts/kusto-detective-agency-case-5/project-x-message.png)

The txt below has further hint, **the key is case 4's answer**

[https://sneakinto.z13.web.core.windows.net/194.243.69.176/utils.txt](https://sneakinto.z13.web.core.windows.net/194.243.69.176/utils.txt)

````txt
// Handy utils

// 1) Utility to discover secondary messages.
// Usage: ReadMessage(Message, Key)
let ReadMessage = (Message:string, Key:string) 
{
    let m = Message; let K = Key; let l = toscalar(print s = split(split(K,':')[1], ',') | mv-expand s | summarize make_list(tolong(s)));
    let ma = (i1:long, i2:long) { make_string(repeat(tolong(l[i1])-tolong(l[i2]), 1))}; 
    let ms = (d:dynamic, s:long, e:long) { make_string(array_slice(d, s, e)) };   
    let mc = m has '...';
    print s=split(split(replace_regex(m, @'[\s\?]+', ' '),substring(K,9,3))[1], ' ')
    | mv-expand with_itemindex=r s to typeof(string) | serialize 
    | where r in (l)
    | extend s = iif(r-1 == prev(r), replace_string(strcat(prev(s), s),'o','ou'), s)
    | where (r+1 != next(r))
    | summarize s=strcat_array(make_list(s), iff(mc, '+%2B', ' '))
    | extend k = series_subtract(series_add(to_utf8(K), l), repeat(23, 10))
    | project result=iif(mc, strcat(ms(k,0,3), ma(8,2), ms(k,4,6), ms(l,8,8), ms(k,7,7), ma(8,0), s), s)
};
ReadMessage(
```
Hi there! How are you?

PS: 
This is a nice utility that reveals what hidden messages the text may have.
We may read the message and think: is there anything beyond words?
Can we find it without the utility, or it will become too much of a headache?
```,
h@'dhkl4fva!that:2,9,15,22,31'
)

// 2) Get GEO location from images:
// Use https://tool.geoimgr.com/
````

````kql
ReadMessage(
```
PS:
Feeling uncomfortable and wondering about an elephant in the room: why would I help you?
Nothing escapes you, ha?
Let’s put it this way: we live in a circus full of competition. I can use some of your help, and nothing breaks if you use mine... You see, everything is about symbiosis.
Anyway, what do you have to lose? Look on an illustrated past, fast forward N days and realize the future is here.
```,
h@'wytaPUJM!PS:2,7,17,29,42,49,58,59,63'
)
````

**Search the decoded URL**

```txt
https://bing.com?q=uncomfortable+%2Belephant+%2Bescapes+%2Bcircus+%2Bbreaks+%2Beverything+%2Btoulouse+%2Billustrated
```

**We get below URL, which has year info "1891"**

[https://www.bridgemanimages.com/en/meaulle/an-uncomfortable-elephant-the-pachyderm-escapes-from-a-circus-menagerie-breaks-everything-in-the/nomedium/asset/5980623](https://www.bridgemanimages.com/en/meaulle/an-uncomfortable-elephant-the-pachyderm-escapes-from-a-circus-menagerie-breaks-everything-in-the/nomedium/asset/5980623)

The last piece is picture project x's taken day and geo location, which can be retrieved from this this picture

[https://sneakinto.z13.web.core.windows.net/146.49.19.37/image3.jpg](https://sneakinto.z13.web.core.windows.net/146.49.19.37/image3.jpg)

![Project X target photo](/assets/posts/kusto-detective-agency-case-5/project-x-target-photo.png)

**Final Answer**

**What is the exact place and time?**

**Date**: \[2022-12-17\] **Longitude**: \[-3.380104\] **Latitude**: \[58.968867\]
