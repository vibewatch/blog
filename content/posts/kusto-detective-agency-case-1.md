---
title: "Kusto Detective Agency Case 1"
slug: "kusto-detective-agency-case-1"
date: "2023-01-10 02:48:16"
updated: "2023-01-10 06:49:10"
type: "post"
status: "published"
visibility: "public"
featured: false
excerpt: ""
feature_image: ""
authors: ["Yingting Huang"]
tags: []
---
## The rarest book is missing!

This was supposed to be a great day for Digitown’s National Library Museum and all of Digitown.  
The museum has just finished scanning more than 325,000 rare books, so that history lovers around the world can experience the ancient culture and knowledge of the Digitown Explorers.  
The great book exhibition was about to re-open, when the museum director noticed that he can't locate the rarest book in the world:  
**"De Revolutionibus Magnis Data", published 1613, by Gustav Kustov**.  
The mayor of the Digitown herself, Mrs. Gaia Budskott - has called on our agency to help find the missing artifact.  
  
Luckily, everything is digital in the Digitown library:

*   \- Each book has its parameters recorded: number of pages, weight.
*   \- Each book has RFID sticker attached (RFID: radio-transmitter with ID).
*   \- Each shelve in the Museum sends data: what RFIDs appear on the shelve and also measures actual total weight of books on the shelve.

  
Unfortunately, the RFID of the "De Revolutionibus Magnis Data" was found on the museum floor - detached and lonely.  
Perhaps, _you_ will be able to locate the book on one of the museum shelves and save the day?  
  
PS: Don't hesitate to reach out for help and use _Hints_ if you're feeling in trouble.

```kql
.execute database script <|
// Create table for the books
.create-merge table Books(rf_id:string, book_title:string, publish_date:long, author:string, language:string, number_of_pages:long, weight_gram:long)
// Import data for books
// (Used data is utilzing catalogue from https://github.com/internetarchive/openlibrary )
.ingest into table Books ('https://kustodetectiveagency.blob.core.windows.net/digitown-books/books.csv.gz') with (ignoreFirstRecord=true)
// Create table for the shelves
.create-merge table Shelves (shelf:long, rf_ids:dynamic, total_weight:long) 
// Import data for shelves
.ingest into table Shelves ('https://kustodetectiveagency.blob.core.windows.net/digitown-books/shelves.csv.gz') with (ignoreFirstRecord=true)
```

**Which shelf is the book on? \[\]**

## Case 1 - Solution

```kql
let x = Books
| where book_title == "De Revolutionibus Magnis Data"
| project weight_gram;
// weight_gram = 1764
let id_shelf = Shelves
| mv-expand rf_ids
| project shelf, rf_id=tostring(rf_ids);
let existing_shelf = Books
| join kind=innerunique id_shelf on $left.rf_id==$right.rf_id
| summarize calculated_weight_gram=sum(weight_gram) by shelf;
existing_shelf
| join kind=innerunique Shelves on $left.shelf==$right.shelf
| where total_weight - calculated_weight_gram >= 1764
```

**Answer: The book is on shelf 4242**
