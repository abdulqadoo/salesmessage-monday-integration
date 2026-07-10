const { google } = require("googleapis");


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


function parseSalesMessageTime(value) {
    if (!value) {
        return null;
    }

    const normalized = String(value).includes("T")
        ? String(value)
        : `${String(value).replace(" ", "T")}Z`;
    const timestamp = Date.parse(normalized);

    return Number.isNaN(timestamp) ? null : new Date(timestamp);
}


function getDriveClient() {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!clientEmail || !privateKey) {
        throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY");
    }

    const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ["https://www.googleapis.com/auth/drive.readonly"]
    });

    return google.drive({ version: "v3", auth });
}


function buildDriveQuery({ folderId, startTime, endTime }) {
    const parts = [
        "trashed = false",
        "(" +
            "mimeType = 'image/jpeg' or " +
            "mimeType = 'image/png' or " +
            "mimeType = 'image/gif' or " +
            "mimeType = 'image/webp' or " +
            "mimeType = 'image/heic' or " +
            "mimeType = 'image/heif'" +
        ")",
        `createdTime >= '${startTime.toISOString()}'`,
        `createdTime <= '${endTime.toISOString()}'`
    ];

    if (folderId) {
        parts.push(`'${folderId}' in parents`);
    }

    return parts.join(" and ");
}


function scoreFile(file, { phone, messageId, conversationId }) {
    const name = String(file.name || "").toLowerCase();
    const cleanPhone = String(phone || "").replace(/\D/g, "");
    let score = 0;

    if (messageId && name.includes(String(messageId).toLowerCase())) {
        score += 100;
    }

    if (conversationId && name.includes(String(conversationId).toLowerCase())) {
        score += 50;
    }

    if (cleanPhone && name.replace(/\D/g, "").includes(cleanPhone.slice(-10))) {
        score += 25;
    }

    return score;
}


function pickBestFile(files, match) {
    const scored = files.map(file => ({
        file,
        score: scoreFile(file, match)
    }));

    scored.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        return new Date(b.file.createdTime) - new Date(a.file.createdTime);
    });

    console.log(
        "Scored candidates:",
        scored.map(s => ({ name: s.file.name, score: s.score, createdTime: s.file.createdTime }))
    );

    return scored[0]?.file || null;
}


async function searchDriveImage({ phone, messageId, conversationId, messageTime, windowBeforeMs, windowAfterMs }) {
    const drive = getDriveClient();
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const parsedMessageTime = parseSalesMessageTime(messageTime) || new Date();
    const startTime = new Date(parsedMessageTime.getTime() - windowBeforeMs);
    const endTime = new Date(parsedMessageTime.getTime() + windowAfterMs);
    const query = buildDriveQuery({ folderId, startTime, endTime });

    console.log("====== DRIVE IMAGE SEARCH ======");
    console.log(`Window: ${startTime.toISOString()} -> ${endTime.toISOString()}`);
    console.log(query);

    const response = await drive.files.list({
        q: query,
        fields: "files(id, name, mimeType, createdTime, modifiedTime, webViewLink)",
        orderBy: "createdTime desc",
        pageSize: 20,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
    });

    const files = response.data.files || [];

    console.log(
        "Drive image candidates:",
        files.map(file => ({ id: file.id, name: file.name, createdTime: file.createdTime }))
    );

    const best = pickBestFile(files, { phone, messageId, conversationId });

    if (!best) {
        return null;
    }

    const bestScore = scoreFile(best, { phone, messageId, conversationId });

    if (bestScore === 0 && files.length > 1) {
        console.log(
            "Multiple unscored candidates in window - skipping this attempt to avoid a wrong match."
        );
        return null;
    }

    return best;
}


async function downloadDriveFile(fileId) {
    const drive = getDriveClient();

    const response = await drive.files.get(
        {
            fileId,
            alt: "media",
            supportsAllDrives: true
        },
        {
            responseType: "arraybuffer"
        }
    );

    return Buffer.from(response.data);
}


async function waitForIncomingMmsImageFromDrive(options) {
    const maxAttempts = options.maxAttempts || Number(process.env.GOOGLE_DRIVE_IMAGE_MAX_ATTEMPTS) || 10;
    const delayMs = options.delayMs || Number(process.env.GOOGLE_DRIVE_IMAGE_DELAY_MS) || 4000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {

        await sleep(delayMs);

        const windowBeforeMs = 10 * 1000;
        const windowAfterMs = Math.min(attempt * 15 * 1000, 5 * 60 * 1000);

        const file = await searchDriveImage({
            ...options,
            windowBeforeMs,
            windowAfterMs
        });

        if (file) {
            const buffer = await downloadDriveFile(file.id);

            console.log(`✅ Matched Drive image on attempt ${attempt}/${maxAttempts}:`, file.name);

            return {
                id: file.id,
                name: file.name,
                buffer,
                webViewLink: file.webViewLink,
                createdTime: file.createdTime
            };
        }

        console.log(`[Drive attempt ${attempt}/${maxAttempts}] No confident match yet`);
    }

    return null;
}


module.exports = {
    waitForIncomingMmsImageFromDrive
};