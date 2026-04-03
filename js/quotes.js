/**
 * Daily quotes from brilliant minds - rotates based on the day of the year.
 */
const QUOTES = [
    { text: "Wyobraźnia jest ważniejsza niż wiedza.", author: "Albert Einstein" },
    { text: "Nie mam specjalnych talentów. Jestem jedynie namiętnie ciekaw.", author: "Albert Einstein" },
    { text: "Logika zabierze Cię z punktu A do punktu B. Wyobraźnia zabierze Cię wszędzie.", author: "Albert Einstein" },
    { text: "Życie jest jak jazda na rowerze. Żeby utrzymać równowagę, musisz się poruszać.", author: "Albert Einstein" },
    { text: "Ktoś, kto nigdy nie popełnił błędu, nigdy nie próbował niczego nowego.", author: "Albert Einstein" },
    { text: "Ważne jest, by nigdy nie przestać pytać. Ciekawość ma swój własny powód istnienia.", author: "Albert Einstein" },
    { text: "Wszystko powinno być tak proste, jak to możliwe, ale nie prostsze.", author: "Albert Einstein" },
    { text: "Świat jest niebezpiecznym miejscem nie z powodu tych, którzy czynią zło, lecz z powodu tych, którzy przyglądają się i nic nie robią.", author: "Albert Einstein" },
    { text: "Nie wszystko, co się liczy, można policzyć, i nie wszystko, co można policzyć, się liczy.", author: "Albert Einstein" },
    { text: "Jeśli nie potrafisz wyjaśnić tego prosto, to znaczy, że nie rozumiesz tego wystarczająco dobrze.", author: "Albert Einstein" },

    { text: "Pierwszą zasadą jest to, że nie wolno Ci się oszukiwać — a Ty jesteś osobą najłatwiejszą do oszukania.", author: "Richard Feynman" },
    { text: "Nie obchodzi mnie, co myślą o mnie inni. Nie chcę tylko myśleć o tym, co ja myślę o sobie.", author: "Richard Feynman" },
    { text: "Wolę mieć pytania, na które nie można odpowiedzieć, niż odpowiedzi, których nie można kwestionować.", author: "Richard Feynman" },
    { text: "Naucz się rozwiązywać każdy problem, który został rozwiązany.", author: "Richard Feynman" },
    { text: "Fizyka jest jak seks: oczywiście, że daje praktyczne rezultaty, ale nie po to się tym zajmujemy.", author: "Richard Feynman" },
    { text: "Wyobrażam sobie, że nie wiemy zbyt wiele... bo im więcej odkrywamy, tym bardziej niesamowity świat się okazuje.", author: "Richard Feynman" },
    { text: "Nauka to wiara w ignorancję ekspertów.", author: "Richard Feynman" },
    { text: "Studiuj ciężko to, co Cię najbardziej interesuje, w najbardziej niezdyscyplinowany sposób.", author: "Richard Feynman" },

    { text: "Jedyne prawdziwe ograniczenia to te, które sami sobie narzucamy.", author: "Marie Curie" },
    { text: "Niczego w życiu nie należy się bać, należy to tylko zrozumieć.", author: "Marie Curie" },
    { text: "Bądź mniej ciekawy ludzi, a bardziej ciekawy idei.", author: "Marie Curie" },
    { text: "Każdy geniusz był kiedyś amatorem.", author: "Marie Curie" },

    { text: "Miarą inteligencji jest zdolność do zmiany.", author: "Stephen Hawking" },
    { text: "Spójrz w gwiazdy, nie pod nogi.", author: "Stephen Hawking" },
    { text: "Jednak spokojne życie nie byłoby tak ekscytujące.", author: "Stephen Hawking" },
    { text: "Inteligencja to umiejętność przystosowania się do zmian.", author: "Stephen Hawking" },

    { text: "Gdzieś coś niesamowitego czeka, żeby zostać odkryte.", author: "Carl Sagan" },
    { text: "Jesteśmy sposobem, w jaki kosmos poznaje sam siebie.", author: "Carl Sagan" },
    { text: "Nadzwyczajne twierdzenia wymagają nadzwyczajnych dowodów.", author: "Carl Sagan" },

    { text: "Nie, nie rozumiesz tego. Ty po prostu się do tego przyzwyczaiłeś.", author: "Richard Feynman" },
    { text: "Kreatywność to inteligencja, która dobrze się bawi.", author: "Albert Einstein" },
    { text: "Głęboko w sercu wszechświata czai się porządek matematyczny.", author: "Nikola Tesla" },
    { text: "Naukowiec nie dąży do natychmiastowego wyniku. Nie spodziewa się, że od razu przyjmie jego idee.", author: "Nikola Tesla" },
    { text: "Przyszłość należy do tych, którzy wierzą w piękno swoich marzeń.", author: "Nikola Tesla" },

    { text: "Natura używa tylko najdłuższych nici, by utkać swoje wzory, a każdy mały kawałek tkaniny ukazuje organizację całej tapety.", author: "Richard Feynman" },
    { text: "W środku trudności leży możliwość.", author: "Albert Einstein" },

    { text: "Jestem wystarczająco artystą, by rysować swobodnie w wyobraźni.", author: "Albert Einstein" },
    { text: "Gdybym miał godzinę na rozwiązanie problemu, spędziłbym 55 minut na myśleniu o problemie, a 5 minut na myśleniu o rozwiązaniu.", author: "Albert Einstein" },

    { text: "Radość patrzenia i rozumienia jest najpiękniejszym darem natury.", author: "Albert Einstein" },
    { text: "Nic w życiu nie przychodzi za darmo. Trzeba bardzo cierpliwie pracować — a i tak nie jest pewne, czy się uda.", author: "Marie Curie" },
];

function getDailyQuote() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const diff = now - startOfYear;
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    const index = dayOfYear % QUOTES.length;
    return QUOTES[index];
}
