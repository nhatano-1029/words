"use strict";

let dictionary = [];

async function loadDictionary() {
    try {
        const response = await fetch("words.json");

        if (!response.ok) {
            throw new Error(
                `words.jsonを読み込めませんでした: ${response.status}`
            );
        }

        dictionary = await response.json();

        validateDictionary(dictionary);
        renderCurrentPage();
    } catch (error) {
        console.error(error);

        document.getElementById("app").innerHTML = `
            <section class="error">
                <h2>読み込みエラー</h2>
                <p>辞書データを読み込めませんでした。</p>
                <p>${escapeHtml(error.message)}</p>
            </section>
        `;
    }
}

function validateDictionary(words) {
    if (!Array.isArray(words)) {
        throw new Error("words.jsonの一番外側は配列にしてください。");
    }

    const usedIds = new Set();

    for (const word of words) {
        if (
            typeof word.id !== "string" ||
            typeof word.name !== "string" ||
            typeof word.description !== "string"
        ) {
            throw new Error(
                "各単語にはid、name、descriptionが必要です。"
            );
        }

        if (usedIds.has(word.id)) {
            throw new Error(`id「${word.id}」が重複しています。`);
        }

        usedIds.add(word.id);
    }
}

function renderCurrentPage() {
    const params = new URLSearchParams(window.location.search);
    const wordId = params.get("word");
    const view = params.get("view");

    if (wordId) {
        renderWordPage(wordId);
    } else if (view === "categories") {
        renderCategoryPage();
    } else {
        renderIndexPage();
    }
}

function sortWords(words) {
    return [...words].sort((a, b) => {
        const aKey = a.reading || a.name;
        const bKey = b.reading || b.name;

        return aKey.localeCompare(bKey, "ja");
    });
}

function createWordListHtml(words, showCategory = true) {
    if (words.length === 0) {
        return `<li class="no-results">該当する単語はありません。</li>`;
    }

    return words.map((word) => `
        <li>
            <a href="?word=${encodeURIComponent(word.id)}">
                ${escapeHtml(word.name)}
            </a>

            ${
                showCategory && word.category
                    ? `<span class="category">${escapeHtml(word.category)}</span>`
                    : ""
            }
        </li>
    `).join("");
}

function renderIndexPage() {
    const app = document.getElementById("app");
    const sortedWords = sortWords(dictionary);

    document.title = "用語集";

    app.innerHTML = `
        <section class="dictionary-index">
            <div class="index-heading">
                <h2>単語一覧</h2>

                <a class="category-page-link" href="?view=categories">
                    分類別に見る
                </a>
            </div>

            <input
                id="search-input"
                class="search-input"
                type="search"
                placeholder="単語を検索"
                autocomplete="off"
            >

            <p id="word-count" class="word-count">
                ${sortedWords.length}件
            </p>

            <ul id="word-list" class="word-list">
                ${createWordListHtml(sortedWords, true)}
            </ul>
        </section>
    `;

    const searchInput = document.getElementById("search-input");

    searchInput.addEventListener("input", (event) => {
        if (event.isComposing) {
            return;
        }

        updateSearchResults(event.target.value);
    });

    searchInput.addEventListener("compositionend", (event) => {
        updateSearchResults(event.target.value);
    });
}

function updateSearchResults(searchText) {
    const normalizedSearch = searchText
        .trim()
        .toLowerCase();

    const filteredWords = sortWords(
        dictionary.filter((word) => {
            const searchableText = [
                word.name,
                word.reading ?? "",
                word.category ?? "",
                word.description
            ]
                .join(" ")
                .toLowerCase();

            return searchableText.includes(normalizedSearch);
        })
    );

    document.getElementById("word-count").textContent =
        `${filteredWords.length}件`;

    document.getElementById("word-list").innerHTML =
        createWordListHtml(filteredWords, true);
}

function renderCategoryPage() {
    const app = document.getElementById("app");

    document.title = "分類別一覧｜用語集";

    const categoryMap = new Map();

    for (const word of dictionary) {
        const category =
            typeof word.category === "string" && word.category.trim()
                ? word.category.trim()
                : "未分類";

        if (!categoryMap.has(category)) {
            categoryMap.set(category, []);
        }

        categoryMap.get(category).push(word);
    }

    const categories = [...categoryMap.keys()].sort((a, b) =>
        a.localeCompare(b, "ja")
    );

    app.innerHTML = `
        <section class="category-index">
            <nav class="breadcrumb">
                <a href="index.html">単語一覧</a>
                <span> ＞ 分類別一覧</span>
            </nav>

            <h2>分類別一覧</h2>

            ${categories.map((category) => {
                const words = sortWords(categoryMap.get(category));

                return `
                    <section
                        class="category-group"
                        id="category-${encodeURIComponent(category)}"
                    >
                        <h3>分類：${escapeHtml(category)}</h3>

                        <ul class="word-list category-word-list">
                            ${createWordListHtml(words, false)}
                        </ul>
                    </section>
                `;
            }).join("")}

            <p class="back-link">
                <a href="index.html">← 単語一覧へ戻る</a>
            </p>
        </section>
    `;
}

function renderWordPage(wordId) {
    const app = document.getElementById("app");

    const currentWord = dictionary.find(
        (word) => word.id === wordId
    );

    if (!currentWord) {
        app.innerHTML = `
            <section class="error">
                <h2>単語が見つかりません。</h2>
                <p><a href="index.html">← 単語一覧へ戻る</a></p>
            </section>
        `;

        return;
    }

    document.title = `${currentWord.name}｜用語集`;

    // One event per successfully displayed dictionary entry.
    if (typeof window.gtag === "function") {
        window.gtag("event", "word_view", {
            word_id: currentWord.id,
            word_name: currentWord.name
        });
    }

    const linkedDescription = createAutomaticLinks(
        currentWord.description,
        currentWord.id
    );

    const categoryText =
        currentWord.category && currentWord.category.trim()
            ? currentWord.category.trim()
            : "未分類";

    app.innerHTML = `
        <article class="word-page">
            <nav class="breadcrumb">
                <a href="index.html">単語一覧</a>
                <span>${escapeHtml(currentWord.name)}</span>
            </nav>

            <h2>${escapeHtml(currentWord.name)}</h2>

            ${
                currentWord.english
                    ? `<p class="word-english">${escapeHtml(currentWord.english)}</p>`
                    : ""
            }

            <p class="word-category">
                分類：
                <a href="?view=categories#category-${encodeURIComponent(categoryText)}">
                    ${escapeHtml(categoryText)}
                </a>
            </p>

            <section class="description">
                <h3>意味</h3>
                <p>${linkedDescription}</p>
            </section>

            <p class="back-link">
                <a href="index.html">← 単語一覧へ戻る</a>
            </p>
        </article>
    `;
}

function createAutomaticLinks(text, currentWordId) {
    const otherWords = dictionary
        .filter((word) => word.id !== currentWordId)
        .sort((a, b) => b.name.length - a.name.length);

    if (otherWords.length === 0) {
        return escapeHtml(text);
    }

    const wordPattern = otherWords
        .map((word) => escapeRegExp(word.name))
        .join("|");

    const regex = new RegExp(`(${wordPattern})`, "g");

    const wordMap = new Map(
        otherWords.map((word) => [word.name, word])
    );

    return text
        .split(regex)
        .map((part) => {
            const matchedWord = wordMap.get(part);

            if (!matchedWord) {
                return escapeHtml(part);
            }

            return `<a class="dictionary-link" href="?word=${encodeURIComponent(matchedWord.id)}">${escapeHtml(part)}</a>`;
        })
        .join("");
}

function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

loadDictionary();
