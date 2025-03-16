### CLC Wallet CLI

A CLI interface for the online CLC wallet (https://clc-crypto.github.io)

Options:
  -V, --version              output the version number
  -h, --help                 display help for command

Commands:
  set-wallet <token>         Set the CLC wallet token & password for this user
  add-coin [options] <path>  Add a coin from the specified path (or directory if
                             -r is specified)
  help [command]             display help for command

### Setting wallet
Usage: CLC wallet CLI set-wallet [options] <token>

Set the CLC wallet token & password for this user

Options:
  -h, --help  display help for command

### Adding Coins
Usage: CLC wallet CLI add-coin [options] <path>

Add a coin from the specified path (or directory if -r is specified)

Options:
  -r, --recursive  Specify if path is a directory, and you want to add all the
                   coins in that directory
  -v, --validate   Specify if you want to validate the coins before adding them
                   to the wallet
  -p, --print      Specify if you want the wallet printed to stdout after adding
                   the coins (will print private keys!)
  -c, --confirm    Specify if you want to be prompted before publishing changes
                   to your wallet
  -h, --help       display help for command
