#!/usr/bin/env node

const Command = require("commander").Command;
const read = require("read").read;
const CryptoJS = require("crypto-js");
const fs = require("fs");
const os = require("os");
const path = require("path");
const EC = require("elliptic").ec;
const readline = require("readline")

const ec = new EC("secp256k1");

const savePath = path.join(os.homedir(), ".clc-wallet-cli");

const confirm = async prompt => {
  const answer = await read({ prompt: prompt + " (y/n) " });
  return answer === "" || answer.toLowerCase() === "y";
}

const getpass = async prompt => {
  return await read({ prompt: prompt, silent: true });
}

const loader = ["/", "-", "\\", "|"];

const setWallet = async token => {
  let i = 0;
  let iid = setInterval(() => process.stdout.write("\rChecking token " + loader[i++ % loader.length]), 50);

  const checkRes = await fetch("https://clc.ix.tc:3000/wallet?token=" + token);
  clearInterval(iid);
  console.log();

  if (checkRes.status !== 200) {
    console.log("Invalid wallet token!");
    return;
  }

  const wallet = (await checkRes.json()).wallet;

  for (let _ = 0; _ < 3; _++) {
    try {
      const passwd = await getpass("Enter wallet encryption password: ");
      console.log();

      const decryptedWallet = CryptoJS.AES.decrypt(wallet, passwd).toString(CryptoJS.enc.Utf8);
      if (decryptedWallet.startsWith("{")) {
        const c = Object.keys(JSON.parse(decryptedWallet)).length;
        console.log("\nWallet contains " + c + ` coin${c === 1 ? '' : 's'}\n`)
        console.log("Successfully added wallet!");

        fs.writeFileSync(savePath, JSON.stringify({ token: token, passwd: passwd }));

        return;
      }
      throw new Error();
    } catch (e) {
      console.error("Invalid password! Try again.");
    }
  }
  console.error("Too many attempts!");
};

const publishChanges = (wallet, creds) => {
  let i = 0;
  let iid = setInterval(() => process.stdout.write("\rPublishing changes " + loader[i++ % loader.length]), 50);

  fetch("https://clc.ix.tc:3000/save-wallet", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      token: creds.token,
      wallet: CryptoJS.AES.encrypt(JSON.stringify(wallet), creds.passwd).toString()
    })
  }).then(res => res.json()).then(data => {
    clearInterval(iid);
    console.log();
    console.log("Wallet saved!");
  }).catch(e => {
    clearInterval(iid);
    console.log();
    console.error("Invaid token or password!");
  });
}

const addCoins = async (cpath, options) => {
  let walletCreds = {};
  try {
    walletCreds = JSON.parse(fs.readFileSync(savePath, "utf-8"));
  } catch (e) {
    console.error("Please add your wallet using set-wallet before adding coins!")
    return;
  }

  try {
    let i = 0;
    let iid = setInterval(() => process.stdout.write("\rDownloading wallet " + loader[i++ % loader.length]), 50);

    const walletDownload = (await (await fetch("https://clc.ix.tc:3000/wallet?token=" + walletCreds.token)).json()).wallet;
    clearInterval(iid);
    console.log();
    if (!walletDownload) throw new Error();
    const wallet = JSON.parse(CryptoJS.AES.decrypt(walletDownload, walletCreds.passwd).toString(CryptoJS.enc.Utf8));

    try {
      if (fs.statSync(cpath).isDirectory() && !options.recursive) {
        console.error(cpath + " is a directory! (specify -r to add all coins in that directory)");
        return;
      }
    } catch (e) {
      console.error(cpath + " does not exist!");
      return;
    }
    if (options.recursive) {
      const coinPaths = fs.readdirSync(cpath);
      for (const coinPath of coinPaths) {
        if (coinPath.startsWith(".")) continue;
        const fCoinPath = path.join(cpath, coinPath);
        if (!fs.statSync(fCoinPath).isFile()) {
          console.log(fCoinPath + " is not a file, skipping...");
          continue;
        }
        if (!coinPath.endsWith(".coin")) {
          console.log(coinPath + " is not a `.coin` file, skipping...");
          continue;
        }
        if (wallet[coinPath.replace(".coin", "")]) {
          console.log(coinPath + " has already been added to this wallet, Skipping...");
          continue;
        }
        const pKey = fs.readFileSync(fCoinPath, "utf-8").replace("\n", "");
        if (options.validate) {
          let iid = setInterval(() => process.stdout.write("\rValidating coin #" + coinPath.replace(".coin", "") + " " + loader[i++ % loader.length]), 50);
          const validateJSON = await (await fetch("https://clc.ix.tc/coin/" + coinPath.replace(".coin", ""))).json();

          clearInterval(iid);

          if (validateJSON.error) {
            console.log();
            console.warn(coinPath + " is invalid! Skipping...");
            continue;
          }

          const coin = validateJSON.coin;
          const key = ec.keyFromPrivate(pKey);
          if (key.getPublic().encode("hex", false) !== coin.transactions[coin.transactions.length - 1].holder) {
            console.log();
            console.warn(coinPath + "'s private key is invalid! Skipping...");
            continue;
          }
          console.log(" Valid");
        }
        wallet[coinPath.replace(".coin", "")] = pKey;
        console.log("Added " + coinPath + " to the wallet!");
      }
    } else {
      if (!fs.statSync(cpath).isFile()) {
        console.error(cpath + " is not a file!");
        return;
      }
      if (!cpath.split("/")[cpath.split("/").length - 1].endsWith(".coin")) {
        console.error(cpath + " is not a `.coin` file!");
        return;
      }
      if (wallet[cpath.split("/")[cpath.split("/").length - 1].replace(".coin", "")]) {
        console.error(cpath + " has already been added to this wallet!");
        return;
      }

      const pKey = fs.readFileSync(cpath, "utf-8").replace("\n", "");
      if (options.validate) {
          let iid = setInterval(() => process.stdout.write("\rValidating coin #" + cpath.split("/")[cpath.split("/").length - 1].replace(".coin", "") + " " + loader[i++ % loader.length]), 50);
          const validateJSON = await (await fetch("https://clc.ix.tc/coin/" + cpath.split("/")[cpath.split("/").length - 1].replace(".coin", ""))).json();

          clearInterval(iid);
          if (validateJSON.error) {
            console.log();
            console.error(cpath + " is invalid!");
            return;
          }

          const coin = validateJSON.coin;
          const key = ec.keyFromPrivate(pKey);
          if (key.getPublic().encode("hex", false) !== coin.transactions[coin.transactions.length - 1].holder) {
            console.log();
            console.error(cpath + "'s private key is invalid!");
            return;
          }
          console.log(" Valid");
      }
      wallet[cpath.split("/")[cpath.split("/").length - 1].replace(".coin", "")] = pKey;
      console.log("Added " + cpath + " to the wallet!");
    }
    console.log("\nDone!");
    if (options.print) console.log(wallet);
    if (options.confirm) {
      if (!await confirm("Publish changes?")) {
        console.log("Aborting...");
        return;
      }
    }
    publishChanges(wallet, walletCreds);
  } catch (e) {
    console.error("Invalid wallet token or password!");
    throw e;
  }
}

const program = new Command();

program
  .name("CLC wallet CLI")
  .description("A CLI interface for the online CLC wallet (https://clc-crypto.github.io)")
  .version("1.0.0");

program
  .command("set-wallet <token>")
  .description("Set the CLC wallet token & password for this user")
  .action(setWallet);

program
  .command("add-coin <path>")
  .description("Add a coin from the specified path (or directory if -r is specified)")
  .option("-r, --recursive", "Specify if path is a directory, and you want to add all the coins in that directory")
  .option("-v, --validate", "Specify if you want to validate the coins before adding them to the wallet")
  .option("-p, --print", "Specify if you want the wallet printed to stdout after adding the coins (will print private keys!)")
  .option("-c, --confirm", "Specify if you want to be prompted before publishing changes to your wallet")
  .action(addCoins);

program.parse(process.argv);
