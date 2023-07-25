import dotenv from "dotenv";
dotenv.config();

import express from "express";
const router = express.Router();

import request from "request";
import axios from "axios";
import qs from "querystring";
import { client_auth, authed_header } from "./utils/client-auth.js";
import randomString from "./utils/random.js";

const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const redirect_uri = process.env.RE_URI;
const front_end_uri = process.env.FRONT_URI;

const stateKey = "spotify_auth_state";
const refreshKey = "refresh_key";
const cookieOption = {
    // Comment out the following 2 lines while in development for the authoriazation flow to work properly
    sameSite:'None',
    secure: true
};

const scope = "user-read-private user-read-playback-state streaming user-modify-playback-state playlist-modify-public user-library-modify user-top-read user-read-currently-playing playlist-read-private user-follow-read user-read-recently-played playlist-modify-private user-follow-modify user-library-read user-read-email";

//API endpoint to send a full spotify endpoint to request data
router.post("/", (req, res) => {
    const endpoint = req.body.endpoint;
    client_auth(client_id, client_secret)
        .then((token) => {
            axios
                .get(endpoint, authed_header(token))
                .then((response) => {
                    res.status(200).send(response.data);
                })
                .catch((error) => {
                    console.log(error);
                    res.send(error);
                });
        })
        .catch((error) => res.send(error));
});

//aux endpoint to make and store a cookie value as the state and redirect to the spotify authorization page
router.get("/login", function (req, res) {
    //respond with randomly generated cookie value for the state key - used to prevent XSRF
    const state = randomString(16);
    res.cookie(stateKey, state);

    //redirect to the spotify authentification page with the required parameters
    res.redirect(
        "https://accounts.spotify.com/authorize?" +
        qs.stringify({
            response_type: "code",
            client_id: client_id,
            scope: scope,
            redirect_uri: redirect_uri,
            state: state,
            show_dialog: true,
        })
    );
});

router.get("/callback", function (req, res) {
    const code = req.query.code || null;
    const state = req.query.state || null;
    const storedState = req.cookies ? req.cookies[stateKey] : null;

    //cross checking the callback state and the stored state
    if (state === null || state !== storedState) {
        res.redirect(
            front_end_uri +
            qs.stringify({
                error: "state_mismatch",
            })
        );
    } else {
        //statekey is not needed anymore since it is to be newly generated every request
        res.clearCookie(stateKey);

        const authOptions = {
            url: "https://accounts.spotify.com/api/token",
            form: {
                code: code,
                redirect_uri: redirect_uri,
                grant_type: "authorization_code",
            },
            headers: {
                Authorization:
                    "Basic " +
                    Buffer.from(client_id + ":" + client_secret).toString("base64"),
            },
            json: true,
        };

        //make the request to get token

        request.post(authOptions, function (error, response, body) {
            if (!error && response.statusCode === 200) {
                var access_token = body.access_token,
                    refresh_token = body.refresh_token;

                res.cookie(refreshKey, refresh_token, cookieOption);

                // Redirecting to front end with access and refresh token as hash params
                res.redirect(
                    front_end_uri + "/#" + qs.stringify({ access_token, refresh_token })
                );
            } else {
                res.redirect(
                    front_end_uri +
                    "/#" +
                    qs.stringify({
                        error: "invalid_token",
                    })
                );
                console.log(error);
            }
        });
    }
});

router.get("/refresh_token", (req, res) => {
    const refresh_key = req.cookies.refresh_key;

    var authOptions = {
        url: "https://accounts.spotify.com/api/token",
        headers: {
            Authorization:
                "Basic " +
                Buffer.from(client_id + ":" + client_secret).toString("base64"),
        },
        form: {
            grant_type: "refresh_token",
            refresh_token: refresh_key,
        },
        json: true,
    };

    request.post(authOptions, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            var { access_token, refresh_token } = body;
            //in case a new refresh token is sent back
            if (refresh_token) {
                res.cookie(refreshKey, refresh_token, cookieOption);
            }
            res.send({ access_token });
        } else {
            res.status(400).send(body.error);
        }
    });
});

router.get("/logout", (req, res) => {
    res.clearCookie(refreshKey, cookieOption);
    res.status(200).send("logged out");
});

export default router;