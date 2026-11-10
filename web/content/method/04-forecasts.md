## Forecasts

Version `{{forecast.version}}`. A projection is only published when it beats a naive guess in testing.

1. Each postings index with at least {{forecast.min_weeks}} weeks of history is turned into weekly averages, and the model works on the logarithm of the index.
2. Six simple models compete: the last value carried forward (naive), a straight-line drift, exponential smoothing with a damped trend, ARIMA(0,1,1) with drift, ARIMA(1,1,1), and the Theta method.
3. Each model is tested by pretending to stand at earlier dates: every {{forecast.origin_step}} weeks over the last {{forecast.backtest_weeks}} weeks, it is fitted on the data up to that date and asked to forecast 13, 26 and 52 weeks ahead.
4. Accuracy is the mean absolute scaled error (MASE): the model's average error divided by the naive model's average error on the same dates. Below 1 means better than naive.
5. The model with the lowest average MASE across the three horizons is chosen. Its projection is published only when its MASE at 26 weeks is below {{forecast.ship_mase_26}}. Otherwise the page says the trend is not predictable enough to project, and gives the recent direction instead.
6. Ranges come from the chosen model's own test errors. Thawline simulates {{forecast.paths}} paths by resampling those errors in blocks of {{forecast.block_weeks}} weeks. The likely range holds the middle half of the paths (25th to 75th percentile) and the wider range holds 80% of them (10th to 90th). Pages show {{forecast.display_weeks}} weeks ahead.
7. The recovery range is read from the paths: the week by which 20% of paths have reached the line, and the week by which 80% have. If 80% do not reach it within two years, the page gives only the earliest likely date or says the line is not reached within two years.

This projects recent patterns forward. It cannot foresee shocks. Every published forecast is kept, and once 26 weeks of them exist this page will compare them with what happened.
