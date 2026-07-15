// ========================================================
// ========================================================
// AUTENTICAÇÃO — Login por matrícula/senha
//
// Usa o Firebase Authentication (e-mail/senha). Como o
// Firebase só entende "e-mail", cada matrícula é convertida
// pra um endereço fake no formato <matricula>@expedicao.local
// só pra servir de identificador único — ninguém recebe
// e-mail de verdade, nem precisa existir esse domínio.
//
// COMO CADASTRAR GENTE PRA LOGAR:
// Firebase Console → Authentication → Users → Add user
// E-mail: <matricula>@expedicao.local   (ex: 12345@expedicao.local)
// Senha: a senha da pessoa
// ========================================================
// ========================================================

// ⚠️ Config do projeto Firebase (expedicao-cd107)
const firebaseConfig = {
    apiKey: "AIzaSyAQ83rTxiPaWDc5Qs5z5ifPwNXA-HI_v_s",
    authDomain: "expedicao-cd107.firebaseapp.com",
    projectId: "expedicao-cd107",
    storageBucket: "expedicao-cd107.firebasestorage.app",
    messagingSenderId: "499997285923",
    appId: "1:499997285923:web:1cbe3c84d7ae2d0e365b96"
};

const DOMINIO_FAKE = "@expedicao.local";

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();

// ---------- LOGIN ----------

function matriculaParaEmail(matricula){

    return matricula.trim() + DOMINIO_FAKE;

}

function mostrarErroLogin(mensagem){

    const el = document.getElementById("loginErro");

    el.textContent = mensagem;
    el.style.display = "block";

}

function ocultarErroLogin(){

    document.getElementById("loginErro").style.display = "none";

}

function fazerLogin(){

    ocultarErroLogin();

    const matricula =
    document.getElementById("loginMatricula").value.trim();

    const senha =
    document.getElementById("loginSenha").value;

    if(!matricula || !senha){

        mostrarErroLogin("Preenche matrícula e senha.");

        return;

    }

    const btn = document.getElementById("btnLogin");

    btn.disabled = true;
    btn.innerText = "Entrando...";

    auth.signInWithEmailAndPassword(
        matriculaParaEmail(matricula),
        senha
    )
    .catch(erro=>{

        console.error(erro);

        const mapaErros = {

            "auth/invalid-credential": "Matrícula ou senha incorretos.",
            "auth/user-not-found": "Matrícula não cadastrada.",
            "auth/wrong-password": "Senha incorreta.",
            "auth/too-many-requests": "Muitas tentativas erradas. Espera um pouco e tenta de novo.",
            "auth/network-request-failed": "Sem conexão com a internet."

        };

        mostrarErroLogin(
            mapaErros[erro.code] || "Erro ao entrar: " + erro.message
        );

    })
    .finally(()=>{

        btn.disabled = false;
        btn.innerText = "🔑 Entrar";

    });

}

function fazerLogout(){

    const confirmaSair =
    confirm("Tem certeza que quer sair?");

    if(!confirmaSair) return;

    auth.signOut();

}

// ---------- CONTROLE DE TELA (login vs app) ----------

auth.onAuthStateChanged(usuario=>{

    const telaLogin = document.getElementById("telaLogin");
    const appConteudo = document.getElementById("appConteudo");

    if(usuario){

        telaLogin.style.display = "none";
        appConteudo.style.display = "block";

        const matricula =
        usuario.email.replace(DOMINIO_FAKE, "");

        document.getElementById("usuarioLogado").innerText =
        "👤 Matrícula " + matricula;

        document.getElementById("loginMatricula").value = "";
        document.getElementById("loginSenha").value = "";

    }else{

        telaLogin.style.display = "flex";
        appConteudo.style.display = "none";

    }

});
