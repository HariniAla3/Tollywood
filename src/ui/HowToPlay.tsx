type Props = { onClose: () => void }

export function HowToPlay({ onClose }: Props) {
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="How to play">
      <div className="modal__panel modal__panel--wide">
        <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <h2 className="howto__title">How to play</h2>

        <p className="howto__lede">
          Guess the mystery Telugu film in <strong>7 tries</strong>.
        </p>

        <p className="howto__p">
          Every guess must be a Telugu film from <strong>2005–2025</strong>. Pick it from the
          dropdown. After each guess the board reveals <strong>only what your guess has in
          common</strong> with the mystery film.
        </p>

        <h3 className="howto__h3">Example</h3>
        <p className="howto__p">
          You guess <strong>Pokiri (2006)</strong>. The board answers:
        </p>

        <div className="howto__demo">
          <div className="howto__row">
            <span className="howto__label">Year</span>
            <span className="cell cell--hidden howto__cell">
              <span className="cell__value">2007 – 2025</span>
            </span>
          </div>
          <div className="howto__row">
            <span className="howto__label">Genre</span>
            <span className="cell cell--matched howto__cell">
              <span className="cell__value">Action</span>
            </span>
            <span className="cell cell--hidden howto__cell">
              <span className="cell__value">?</span>
            </span>
          </div>
          <div className="howto__row">
            <span className="howto__label">Cast</span>
            <span className="cell cell--hidden howto__cell">
              <span className="cell__label">4</span>
              <span className="cell__value">?</span>
            </span>
            <span className="cell cell--matched howto__cell">
              <span className="cell__label">5</span>
              <span className="cell__value">Prakash Raj</span>
            </span>
          </div>
        </div>

        <ul className="howto__list">
          <li>
            <strong>Green means shared.</strong> Pokiri and the mystery film are both{' '}
            <em>Action</em>, and they share <em>Prakash Raj</em>.
          </li>
          <li>
            <strong>Cast cells are numbered by billing order.</strong> He opened cell{' '}
            <strong>5</strong>, so he is the fifth-billed actor in today&rsquo;s film — not the
            hero.
          </li>
          <li>
            <strong>The year never shows outright.</strong> Pokiri is 2006 and nothing opened, so
            the mystery film is <em>newer</em> — the range starts at 2007. Guess something newer
            and the top of the range comes down.
          </li>
          <li>
            <strong>Nothing else from Pokiri is in it.</strong> A blank cell is information too —
            Mahesh Babu and Puri Jagannadh are now ruled out.
          </li>
        </ul>

        <h3 className="howto__h3">Help along the way</h3>
        <ul className="howto__list">
          <li>
            Stuck? A <strong>riddle</strong> about the film unlocks after your sixth guess.
          </li>
          <li>
            After guess <strong>4</strong> and guess <strong>6</strong>, you can reveal any one
            cell you choose.
          </li>
          <li>
            Out of guesses at 7? You can take <strong>3 more</strong> — your result says so.
          </li>
        </ul>

        <p className="howto__foot">
          A new film every day at <strong>midnight IST</strong>. Missed one? It&rsquo;s under{' '}
          <em>Past days</em>.
        </p>

        <button type="button" className="lifelines__btn howto__go" onClick={onClose}>
          Let&rsquo;s play
        </button>
      </div>
    </div>
  )
}
