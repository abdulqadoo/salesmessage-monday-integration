exports.relationshipWebhook = async (req, res) => {

    try {

        console.log("========== RELATIONSHIP WEBHOOK ==========");
        console.log(JSON.stringify(req.body, null, 2));

        // Monday challenge
        if (req.body.challenge) {
            return res.status(200).json({
                challenge: req.body.challenge
            });
        }

        return res.status(200).json({
            success: true
        });

    } catch (err) {

        console.log(err);

        return res.status(500).json({
            success: false,
            error: err.message
        });

    }

};