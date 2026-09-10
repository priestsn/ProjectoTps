/**
 * Determina il vincitore e mostra il risultato
 */
function determineWinner({ player, enemy, timerId }) {
    clearTimeout(timerId);
    if (player.health === enemy.health) {
        document.querySelector('#displayText').innerHTML = 'Pareggio!';
    } else if (player.health > enemy.health) {
        document.querySelector('#displayText').innerHTML = 'Giocatore 1 Vince!';
    } else {
        document.querySelector('#displayText').innerHTML = 'Giocatore 2 Vince!';
    }
}

let timer = 60;
let timerId;

/**
 * Timer di conto alla rovescia che gestisce la rigenerazione della stamina e la fine del gioco
 */
function decreaseTimer() {
    if (timer > 0) {
        timer--;
        timerId = setTimeout(decreaseTimer, 1000);
        document.querySelector('#timer').innerHTML = timer;

        // Rigenera stamina ogni 2 secondi
        if (Player.stamina < 100 && timer % 2 === 0) {
             Player.stamina += 10;
            
        }
        if (Enemy.stamina < 100 && timer % 2 === 0) {
            Enemy.stamina += 10;
        }
    }

    if (timer === 0) {
        document.querySelector('#displayText').style.display = 'flex';
        determineWinner({ Player, Enemy, timerId });
    }
}