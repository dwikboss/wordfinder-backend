const OpenAI = require("openai");
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const RSSParser = require("rss-parser");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const parser = new RSSParser();

async function fetchRSSFeed() {
    try {
        const feed = await parser.parseURL('https://www.nu.nl/rss/Algemeen');
        const items = feed.items.slice(0, 10).map(item => ({
            title: item.title,
            content: item.contentSnippet,
            link: item.link
        }));
        // console.log(feed);
        return items;
    } catch (error) {
        console.error("Error fetching RSS feed:", error);
        throw new Error("Failed to fetch RSS feed");
    }
}

async function handlePuzzle(feedItems) {
    try {
        const rssContent = feedItems.map(item => `${item.title}: ${item.content}: ${item.link}`).join("\n");
        const completion = await openai.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `Create a wordfinder puzzle of 6 words based on the following RSS feed titles and their contents:\n\n${rssContent}\n\nThe JSON needs to be returned in this format:
                        words: [
                            {
                                "word": "APPLE",
                                "hint": A red round fruit,
                                "link": LINK_FROM_RSS
                                "positions": [
                                    { "letter": "A", "row": 1 (CAN'T BE 15 OR HIGHER), "col": 1 (CAN'T BE 15 OR HIGHER) },
                                    { "letter": "P", "row": 1 (CAN'T BE 15 OR HIGHER), "col": 2 (CAN'T BE 15 OR HIGHER) },
                                    { "letter": "P", "row": 1 (CAN'T BE 15 OR HIGHER), "col": 3 (CAN'T BE 15 OR HIGHER) },
                                    { "letter": "L", "row": 1 (CAN'T BE 15 OR HIGHER), "col": 4 (CAN'T BE 15 OR HIGHER) },
                                    { "letter": "E", "row": 1 (CAN'T BE 15 OR HIGHER), "col": 5 (CAN'T BE 15 OR HIGHER) }
                                ]
                            },
                            {
                                "word": "ORANGE",
                                "hint": An orange colored round fruit,
                                "link": LINK_FROM_RSS
                                "positions": [
                                    { "letter": "O", "row": 2 (CAN'T BE 15 OR HIGHER), "col": 1 (CAN'T BE 15 OR HIGHER) },
                                    { "letter": "R", "row": 3 (CAN'T BE 15 OR HIGHER), "col": 1 (CAN'T BE 15 OR HIGHER) },
                                    { "letter": "A", "row": 4 (CAN'T BE 15 OR HIGHER), "col": 1 (CAN'T BE 15 OR HIGHER) },
                                    { "letter": "N", "row": 5 (CAN'T BE 15 OR HIGHER), "col": 1 (CAN'T BE 15 OR HIGHER) },
                                    { "letter": "G", "row": 6 (CAN'T BE 15 OR HIGHER), "col": 1 (CAN'T BE 15 OR HIGHER) },
                                    { "letter": "E", "row": 7 (CAN'T BE 15 OR HIGHER), "col": 1 (CAN'T BE 15 OR HIGHER) }
                                ]
                            }
                        ]. 
                        
                        IMPORTANT:

                        1. WORDS CAN NOT INTERSECT WITH EACHOTHER
                        2. LETTERS CAN NOT HAVE A ROW OR COL OF 16 OR HIGHER! 15 IS THE ABSOLUTE MAX.
                        3. WHEN A WORD INTERSECTS, GENERATE THAT POSITION FOR THAT WORD ALL OVER AGAIN! RINSE AND REPEAT UNTIL THERE ARE NO INTERSECTIONS AT ALL!
                        4. LETTERS HAVE TO BE ADJACENT! SO EITHER THE ROWS OR COLS OF A SINGLE WORD NEED TO MATCH!
                        
                        
                        Add the hints based on the content provided from the news articles in Dutch!.`
                }
            ],
            model: "gpt-4o",
            response_format: { "type": "json_object" },
        });
        return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
        console.error("Error:", error);
        throw new Error("Failed to process message");
    }
}

async function verifyWords(words) {
    try {
        const puzzleWords = JSON.stringify(words);
        console.log("incoming words: " + puzzleWords);
        const completion = await openai.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `This is a JSON which contains words and their corresponding letter positions for a wordfinder puzzle:\n\n${puzzleWords}\n\n
                        I want you to check the JSON I gave you for duplicate letters. Go over ALL of the letter objects and check if ANY letter in the WHOLE JSON have a duplicate row/col combination.

                        So for example, if the letter K from word 1 has row: 14, col: 5, then another letter from another word CAN't also have row: 14 and col: 5.
                        
                        WORDS CAN NOT INTERSECT WITH EACHOTHER.
                        Rinse and repeat until no duplicates remain.

                        Also check that there are no letters which have either a row or col of 15. Words should be horizontal and vertical (they should either have matching rows or matching cols, use some variation here to make the word finder puzzle more random). If a word is too long and goes out of bounds (e.g. a 10 letter word that starts at col 12 even tho my grid is only 15x15) you should find a new place for it. Remember: Every tile (e.g. row: 1, col: 1) can only have 1 letter!
                        
                        So remember: If you find any duplicate, generate new positions for all of the letters of THAT word.
                        Rinse and repeat until no duplicates remain.
                        When you're done, make sure to return the improved JSON back in its same format.`
                }
            ],
            model: "gpt-4o",
            response_format: { "type": "json_object" },
        });
        console.log(completion.choices[0].message.content);
        return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
        console.error("Error:", error);
        throw new Error("Failed to process message");
    }
}

app.post("/generate", async (req, res) => {
    try {
        const feedItems = await fetchRSSFeed();
        const puzzleReply = await handlePuzzle(feedItems);
        const verifiedPuzzle = await verifyWords(puzzleReply);

        res.json({ reply: verifiedPuzzle });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

module.exports = app;

// ---------------

// const OpenAI = require("openai");
// const express = require("express");
// const cors = require("cors");
// const bodyParser = require("body-parser");
// const dotenv = require("dotenv");
// const RSSParser = require("rss-parser");

// dotenv.config();

// const app = express();
// const port = process.env.PORT || 3000;

// app.use(cors());
// app.use(bodyParser.json());

// const openai = new OpenAI({
//     apiKey: process.env.OPENAI_API_KEY,
// });

// const parser = new RSSParser();

// async function fetchRSSFeed() {
//     try {
//         const feed = await parser.parseURL('https://www.nu.nl/rss/Algemeen');
//         const items = feed.items.slice(0, 10).map(item => ({
//             title: item.title,
//             content: item.contentSnippet
//         }));
//         console.log(items);
//         return items;
//     } catch (error) {
//         console.error("Error fetching RSS feed:", error);
//         throw new Error("Failed to fetch RSS feed");
//     }
// }

// async function handlePuzzle(feedItems) {
//     try {
//         const rssContent = feedItems.map(item => `${item.title}: ${item.content}`).join("\n");
//         const completion = await openai.chat.completions.create({
//             messages: [
//                 {
//                     role: "system",
//                     content: `Create a wordfinder puzzle of 6 words based on the following RSS feed titles and their contents:\n\n${rssContent}\n\nThe JSON needs to be returned in this format:
//                         words: [
//                             {
//                                 "word": "APPLE",
//                                 "hint": A red round fruit,
//                                 "positions": [
//                                     { "letter": "A", "row": 1 (CAN'T BE 16 OR HIGHER), "col": 1 (CAN'T BE 15 OR HIGHER) },
//                                     { "letter": "P", "row": 1 (CAN'T BE 16 OR HIGHER), "col": 2 (CAN'T BE 15 OR HIGHER) },
//                                     { "letter": "P", "row": 1 (CAN'T BE 16 OR HIGHER), "col": 3 (CAN'T BE 15 OR HIGHER) },
//                                     { "letter": "L", "row": 1 (CAN'T BE 16 OR HIGHER), "col": 4 (CAN'T BE 15 OR HIGHER) },
//                                     { "letter": "E", "row": 1 (CAN'T BE 16 OR HIGHER), "col": 5 (CAN'T BE 15 OR HIGHER) }
//                                 ]
//                             },
//                             {
//                                 "word": "ORANGE",
//                                 "hint": An orange colored round fruit,
//                                 "positions": [
//                                     { "letter": "O", "row": 2 (CAN'T BE 15 OR HIGHER), "col": 1 (CAN'T BE 15 OR HIGHER) },
//                                     { "letter": "R", "row": 3 (CAN'T BE 15 OR HIGHER), "col": 1 (CAN'T BE 15 OR HIGHER) },
//                                     { "letter": "A", "row": 4 (CAN'T BE 15 OR HIGHER), "col": 1 (CAN'T BE 15 OR HIGHER) },
//                                     { "letter": "N", "row": 5 (CAN'T BE 15 OR HIGHER), "col": 1 (CAN'T BE 15 OR HIGHER) },
//                                     { "letter": "G", "row": 6 (CAN'T BE 15 OR HIGHER), "col": 1 (CAN'T BE 15 OR HIGHER) },
//                                     { "letter": "E", "row": 7 (CAN'T BE 15 OR HIGHER), "col": 1 (CAN'T BE 15 OR HIGHER) }
//                                 ]
//                             }
//                         ]. 
                        
//                         IMPORTANT:

//                         1. WORDS CAN NOT INTERSECT WITH EACHOTHER
//                         2. LETTERS CAN NOT HAVE A ROW OR COL OF 16 OR HIGHER! 15 IS THE ABSOLUTE MAX.
                        
                        
//                         Add the hints based on the content provided from the news articles in Dutch!.`
//                 }
//             ],
//             model: "gpt-4o",
//             response_format: { "type": "json_object" },
//         });
//         return JSON.parse(completion.choices[0].message.content);
//     } catch (error) {
//         console.error("Error:", error);
//         throw new Error("Failed to process message");
//     }
// }

// async function verifyWords(words) {
//     try {
//         const puzzleWords = JSON.stringify(words);
//         console.log("incoming words: " + puzzleWords);
//         const completion = await openai.chat.completions.create({
//             messages: [
//                 {
//                     role: "system",
//                     content: `This is a JSON which contains words and their corresponding letter positions for a wordfinder puzzle:\n\n${puzzleWords}\n\n
//                         I want you to check the JSON I gave you for duplicate letters. Go over ALL of the letter objects and check if ANY letter in the WHOLE JSON have a duplicate row/col combination.

//                         So for example, if the letter K from word 1 has row: 14, col: 5, then another letter from another word CAN't also have row: 14 and col: 5.
                        
//                         WORDS CAN NOT INTERSECT WITH EACHOTHER.
//                         Rinse and repeat until no duplicates remain.

//                         Also check that there are no letters which have either a row or col of 15. Words should be horizontal and vertical (they should either have matching rows or matching cols, use some variation here to make the word finder puzzle more random). If a word is too long and goes out of bounds (e.g. a 10 letter word that starts at col 12 even tho my grid is only 15x15) you should find a new place for it. Remember: Every tile (e.g. row: 1, col: 1) can only have 1 letter!
                        
//                         So remember: If you find any duplicate, generate new positions for all of the letters of THAT word.
//                         Rinse and repeat until no duplicates remain.
//                         When you're done, make sure to return the improved JSON back in its same format.`
//                 }
//             ],
//             model: "gpt-4o",
//             response_format: { "type": "json_object" },
//         });
//         console.log(completion.choices[0].message.content);
//         return JSON.parse(completion.choices[0].message.content);
//     } catch (error) {
//         console.error("Error:", error);
//         throw new Error("Failed to process message");
//     }
// }

// app.post("/generate", async (req, res) => {
//     try {
//         const feedItems = await fetchRSSFeed();
//         const puzzleReply = await handlePuzzle(feedItems);
//         const verifiedPuzzle = await verifyWords(puzzleReply);

//         res.json({ reply: verifiedPuzzle });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

// app.listen(port, () => {
//     console.log(`Server is running on http://localhost:${port}`);
// });

// module.exports = app;
