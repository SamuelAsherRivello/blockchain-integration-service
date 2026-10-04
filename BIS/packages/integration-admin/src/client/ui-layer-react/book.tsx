import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './book.css';

type Language = 'english' | 'georgian';

const amazonUrl = 'https://www.amazon.com/Courage-Be-Disliked-Phenomenon-Happiness/dp/1501197274';

function EnglishContent() {
  return <>
    <p className="lede">A short guide to the book’s distinction between looking for causes and looking for purpose.</p>
    <section className="chapter" aria-labelledby="english-terms">
      <p className="section-label">The central distinction</p>
      <h2 id="english-terms">Etiology and teleology</h2>
      <p><strong>Etiology</strong> asks, “What past cause produced this?” <strong>Teleology</strong> asks, “What purpose or goal is this serving now?”</p>
    </section>
    <section className="chapter" aria-labelledby="english-object">
      <p className="section-label">Example one</p>
      <h2 id="english-object">An object on the table</h2>
      <p>Imagine a glass sitting on a table.</p>
      <div className="interpretations">
        <article>
          <h3>The average person’s interpretation</h3>
          <p>“The glass is there because someone placed it there.” The explanation looks backward for a cause: a person, an action, or an event.</p>
        </article>
        <article className="master">
          <h3>The master’s interpretation</h3>
          <p>“What is the glass doing here now?” Perhaps it is being used for drinking, holding a flower, or stopping papers from blowing away. The master focuses on the object’s present function or purpose.</p>
        </article>
      </div>
      <p className="takeaway">Etiology explains origin; teleology explains present purpose.</p>
    </section>
    <section className="chapter" aria-labelledby="english-anger">
      <p className="section-label">Example two</p>
      <h2 id="english-anger">The emotion of anger</h2>
      <p>Suppose a waiter spills coffee on someone, and the customer shouts.</p>
      <div className="interpretations">
        <article>
          <h3>The average person’s interpretation</h3>
          <p>“The coffee spill caused the anger.” Anger is viewed as an automatic reaction to the event.</p>
        </article>
        <article className="master">
          <h3>The master’s interpretation</h3>
          <p>“The person used anger to achieve a goal.” The goal might be to intimidate the waiter, force an apology, assert superiority, or regain control. Anger becomes a tool that can be used and put aside when it no longer serves its purpose.</p>
        </article>
      </div>
      <p className="takeaway">The average person: “I shouted because I became angry.”<br />The master: “I used anger because I wanted to achieve something by shouting.”</p>
    </section>
    <p className="closing">This reflects the book’s Adlerian distinction: etiology explains causes; teleology explains purposes.</p>
  </>;
}

function GeorgianContent() {
  return <>
    <p className="lede">წიგნის მთავარი განსხვავების მოკლე გზამკვლევი: მიზეზების ძიება და მიზნის ძიება.</p>
    <section className="chapter" aria-labelledby="georgian-terms">
      <p className="section-label">მთავარი განსხვავება</p>
      <h2 id="georgian-terms">ეტიოლოგია და ტელეოლოგია</h2>
      <p><strong>ეტიოლოგია</strong> კითხულობს: „რა წარსულმა მიზეზმა წარმოშვა ეს?“ <strong>ტელეოლოგია</strong> კი კითხულობს: „ახლა რა მიზანს ემსახურება ეს?“</p>
    </section>
    <section className="chapter" aria-labelledby="georgian-object">
      <p className="section-label">მაგალითი პირველი</p>
      <h2 id="georgian-object">მაგიდა და მასზე დადებული საგანი</h2>
      <p>წარმოვიდგინოთ, რომ მაგიდაზე ჭიქა დგას.</p>
      <div className="interpretations">
        <article>
          <h3>საშუალო ადამიანის ინტერპრეტაცია</h3>
          <p>„ჭიქა აქ იმიტომ დგას, რომ ვიღაცამ დადო.“ ახსნა უკან, მიზეზისკენ იყურება: ადამიანი, მოქმედება ან მოვლენა.</p>
        </article>
        <article className="master">
          <h3>ოსტატის ინტერპრეტაცია</h3>
          <p>„ახლა რას აკეთებს აქ ეს ჭიქა?“ შესაძლოა, მას სვამენ, ყვავილისთვის იყენებენ ან ქაღალდებს ქარისგან იცავს. ოსტატი ყურადღებას საგნის ამჟამინდელ ფუნქციასა და მიზანზე ამახვილებს.</p>
        </article>
      </div>
      <p className="takeaway">ეტიოლოგია წარმოშობას ხსნის; ტელეოლოგია — დღევანდელ მიზანს.</p>
    </section>
    <section className="chapter" aria-labelledby="georgian-anger">
      <p className="section-label">მაგალითი მეორე</p>
      <h2 id="georgian-anger">ბრაზის ემოცია</h2>
      <p>წარმოვიდგინოთ, რომ მიმტანმა ვიღაცას ყავა გადაასხა და მომხმარებელმა ყვირილი დაიწყო.</p>
      <div className="interpretations">
        <article>
          <h3>საშუალო ადამიანის ინტერპრეტაცია</h3>
          <p>„ყავის დაღვრამ ბრაზი გამოიწვია.“ ბრაზი მოვლენაზე ავტომატურ რეაქციად აღიქმება.</p>
        </article>
        <article className="master">
          <h3>ოსტატის ინტერპრეტაცია</h3>
          <p>„ადამიანმა ბრაზი მიზნის მისაღწევად გამოიყენა.“ მიზანი შეიძლება იყოს მიმტანის დაშინება, ბოდიშის იძულება, უპირატესობის დამტკიცება ან კონტროლის დაბრუნება. ბრაზი იქცევა იარაღად, რომლის გამოყენებაც შეიძლება და შემდეგ გვერდზე გადადება, როცა ის მიზანს აღარ ემსახურება.</p>
        </article>
      </div>
      <p className="takeaway">საშუალო ადამიანი: „ვიყვირე, რადგან გავბრაზდი.“<br />ოსტატი: „ბრაზი გამოვიყენე, რადგან ყვირილით რაღაცის მიღწევა მინდოდა.“</p>
    </section>
    <p className="closing">ეს გამოხატავს წიგნის ადლერისეულ განსხვავებას: ეტიოლოგია მიზეზებს ხსნის; ტელეოლოგია — მიზნებს.</p>
  </>;
}

function BookPage() {
  const [language, setLanguage] = useState<Language>('english');
  return <div className="book-page">
    <header className="book-header">
      <div className="book-header-inner">
        <p className="eyebrow">A reading note</p>
        <h1>The Courage to Be Disliked</h1>
        <p className="subtitle">Etiology, teleology, and the meaning we give to our actions.</p>
        <a className="book-link" href={amazonUrl} target="_blank" rel="noreferrer">Find the book on Amazon <span aria-hidden="true">↗</span></a>
      </div>
    </header>
    <main className="reading-shell">
      <div className="tabs" role="tablist" aria-label="Choose reading language">
        <button className={language === 'english' ? 'active' : ''} role="tab" aria-selected={language === 'english'} onClick={() => setLanguage('english')}>English</button>
        <button className={language === 'georgian' ? 'active' : ''} role="tab" aria-selected={language === 'georgian'} onClick={() => setLanguage('georgian')}>ქართული</button>
      </div>
      <article className="reading-content" lang={language === 'english' ? 'en' : 'ka'}>
        {language === 'english' ? <EnglishContent /> : <GeorgianContent />}
      </article>
    </main>
    <footer>Based on the Adlerian ideas discussed in <em>The Courage to Be Disliked</em>.</footer>
  </div>;
}

createRoot(document.getElementById('root')!).render(<BookPage />);
