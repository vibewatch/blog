---
title: "Kusto Detective Agency Case 4"
slug: "kusto-detective-agency-case-4"
date: "2023-01-10 05:20:48"
updated: "2023-01-14 12:35:56"
type: "post"
status: "published"
visibility: "public"
featured: false
excerpt: ""
feature_image: ""
authors: ["Yingting Huang"]
tags: []
---
## El Puente - **Ready to play?**

Hello. I have been watching you, and I am pretty impressed with your abilities of hacking and cracking little crimes.  
Want to play big? Here is a prime puzzle for you. Find what it means and prove yourself worthy.  
  

```txt
20INznpGzmkmK2NlZ0JILtO4OoYhOoYUB0OrOoTl5mJ3KgXrB0[8LTSSXUYhzUY8vmkyKUYevUYrDgYNK07yaf7soC3kKgMlOtHkLt[kZEclBtkyOoYwvtJGK2YevUY[v65iLtkeLEOhvtNlBtpizoY[v65yLdOkLEOhvtNlDn5lB07lOtJIDmllzmJ4vf7soCpiLdYIK0[eK27soleqO6keDpYp2CeH5d\F\fN6aQT6aQL[aQcUaQc[aQ57aQ5[aQDG
```

Start by grabbing Prime Numbers from  
[https://kustodetectiveagency.blob.core.windows.net/prime-numbers/prime-numbers.csv.gz](https://kustodetectiveagency.blob.core.windows.net/prime-numbers/prime-numbers.csv.gz) and educate yourself on Special Prime numbers ([https://www.geeksforgeeks.org/special-prime-numbers](https://www.geeksforgeeks.org/special-prime-numbers)), this should get you to  
**https://aka.ms/{Largest special prime under 100M}**  
  
Once you get this done – you will get the next hint.  
  
Cheers,  
El Puente.

**What does the puzzle mean?** \[\]

## **Case 4 - Solution**

### Create a prime numbers table and import the data

```kql
.execute database script <|
.create-merge table PrimeNumbers (PrimeNumber: int)
.ingest async into table PrimeNumbers (@'https://kustodetectiveagency.blob.core.windows.net/prime-numbers/prime-numbers.csv.gz')
```

### Calculate prime number and generate URL

```kql
let SpecialPrimeNumberCandidates = PrimeNumbers
| sort by PrimeNumber asc 
| project PrimeNumber = toint(1 + PrimeNumber +  prev(PrimeNumber)), Number1= prev(PrimeNumber), Number2 = PrimeNumber
| where PrimeNumber < 100000000;
SpecialPrimeNumberCandidates
| join kind=inner PrimeNumbers on PrimeNumber
| top 1 by PrimeNumber desc 
| project url = strcat("https://aka.ms/", tostring(PrimeNumber))
```

The URL is https://aka.ms/99999517

Visiting this URL you will get below hints

Well done, my friend. It's time to meet. Let's go for a virtual sTREEt tour... Across the Big Apple city, there is a special place with Turkish Hazelnut and four Schubert Chokecherries within 66-meters radius area. Go 'out' and look for me there, near the smallest American Linden tree (within the same area). Find me and the bottom line: my key message to you. Cheers, El Puente.

PS: You know what to do with the following:

\----------------------------------------------------------------------------------------------

```kql
.execute database script <|
// The data below is from https://data.cityofnewyork.us/Environment/2015-Street-Tree-Census-Tree-Data/uvpi-gqnh 
// The size of the tree can be derived using 'tree_dbh' (tree diameter) column.
.create-merge table nyc_trees 
       (tree_id:int, block_id:int, created_at:datetime, tree_dbh:int, stump_diam:int, 
curb_loc:string, status:string, health:string, spc_latin:string, spc_common:string, steward:string,
guards:string, sidewalk:string, user_type:string, problems:string, root_stone:string, root_grate:string,
root_other:string, trunk_wire:string, trnk_light:string, trnk_other:string, brch_light:string, brch_shoe:string,
brch_other:string, address:string, postcode:int, zip_city:string, community_board:int, borocode:int, borough:string,
cncldist:int, st_assem:int, st_senate:int, nta:string, nta_name:string, boro_ct:string, ['state']:string,
latitude:real, longitude:real, x_sp:real, y_sp:real, council_district:int, census_tract:int, ['bin']:int, bbl:long)
with (docstring = "2015 NYC Tree Census")
.ingest async into table nyc_trees ('https://kustodetectiveagency.blob.core.windows.net/el-puente/1.csv.gz')
.ingest async into table nyc_trees ('https://kustodetectiveagency.blob.core.windows.net/el-puente/2.csv.gz')
.ingest async into table nyc_trees ('https://kustodetectiveagency.blob.core.windows.net/el-puente/3.csv.gz')
// Get a virtual tour link with Latitude/Longitude coordinates
.create-or-alter function with (docstring = "Virtual tour starts here", skipvalidation = "true") VirtualTourLink(lat:real, lon:real) { 
	print Link=strcat('https://www.google.com/maps/@', lat, ',', lon, ',4a,75y,32.0h,79.0t/data=!3m7!1e1!3m5!1s-1P!2e0!5s20191101T000000!7i16384!8i8192')
}
// Decrypt message helper function. Usage: print Message=Decrypt(message, key)
.create-or-alter function with 
  (docstring = "Use this function to decrypt messages")
  Decrypt(_message:string, _key:string) { 
    let S = (_key:string) {let r = array_concat(range(48, 57, 1), range(65, 92, 1), range(97, 122, 1)); 
    toscalar(print l=r, key=to_utf8(hash_sha256(_key)) | mv-expand l to typeof(int), key to typeof(int) | order by key asc | summarize make_string(make_list(l)))};
    let cypher1 = S(tolower(_key)); let cypher2 = S(toupper(_key)); coalesce(base64_decode_tostring(translate(cypher1, cypher2, _message)), "Failure: wrong key")
}
```

### Calculate possible location

```kql
let Schubert = nyc_trees
| where spc_common has "'Schubert' chokecherry"
| project tree_id, block_id, spc_common, latitude, longitude, h3_cell=geo_point_to_h3cell(longitude, latitude,10);
let Turkish = nyc_trees
| where spc_common has "Turkish Hazelnut"
| project tree_id, block_id, spc_common, latitude, longitude,h3_cell=geo_point_to_h3cell(longitude, latitude,10);
let PossibleLocations = Turkish
| join kind=inner  (Schubert) on h3_cell
| summarize count() by tree_id, latitude, longitude,h3_cell
| where count_ == 4;
let Linden = nyc_trees
| where spc_common has "American linden"
| project tree_id, block_id, spc_common, latitude, longitude, tree_dbh,h3_cell=geo_point_to_h3cell(longitude, latitude,10)
| where h3_cell=="8a2a100dec9ffff";
PossibleLocations
| join kind=inner Linden on h3_cell
| top 1 by tree_dbh asc
| project latitude=latitude1, longitude=longitude1
```

### Get the map URL

```kql
VirtualTourLink(40.71222313, -73.96452201)
```

[

Google Maps

Find local businesses, view maps and get driving directions in Google Maps.

![](https://www.google.com/images/branding/product/ico/maps15_bnuw3a_32dp.ico)Google Maps

![](https://maps.google.com/maps/api/staticmap?center=40.71222313%2C-73.96452201&zoom=24&size=256x256&language=en&sensor=false&client=google-maps-frontend&signature=fvlsedH-hect1DF0SPztYTA-4gM)

](https://www.google.com/maps/@40.71222313,-73.96452201,4a,75y,32.0h,79.0t/data=!3m7!1e1!3m5!1s-1P!2e0!5s20191101T000000!7i16384!8i8192)

![Street View mural hint](/assets/posts/kusto-detective-agency-case-4/street-view-mural-hint.png)

Hint is here

### Decode the message

```kql
print Message=Decrypt(@"20INznpGzmkmK2NlZ0JILtO4OoYhOoYUB0OrOoTl5mJ3KgXrB0[8LTSSXUYhzUY8vmkyKUYevUYrDgYNK07yaf7soC3kKgMlOtHkLt[kZEclBtkyOoYwvtJGK2YevUY[v65iLtkeLEOhvtNlBtpizoY[v65yLdOkLEOhvtNlDn5lB07lOtJIDmllzmJ4vf7soCpiLdYIK0[eK27soleqO6keDpYp2CeH5d\F\fN6aQT6aQL[aQcUaQc[aQ57aQ5[aQDG", "ASHES to ASHES")
```

### Final message from EI Puente

"Message": Impressive, you got it right! Something BIG is going to happen...Keep the next hint close to you, it will help you. We will be in touch soon.El Puente.  
wytaPUJM!PS:2,7,17,29,42,49,58,59,63  

**Answer: What does the puzzle mean?** \[wytaPUJM!PS:2,7,17,29,42,49,58,59,63\]
