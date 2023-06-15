const code_blocks = document.querySelectorAll("pre.highlight > code");

const INITIAL_HTML = "<i class='fas fa-clipboard'></i>"

code_blocks.forEach((code_block) => {
    const button = document.createElement("button");

    button.className = "copy-btn";
    button.innerHTML = INITIAL_HTML;

    button.addEventListener("click", () => {
        navigator.clipboard.writeText(code_block.querySelector(".rouge-code").innerText).then(() => {
            button.innerHTML = "<i class='fas fa-check'></i>"
            setTimeout(() => {
                button.innerHTML = INITIAL_HTML;
            }, 2000);
        });
    });

    code_block.parentNode.insertBefore(button, code_block);
});
